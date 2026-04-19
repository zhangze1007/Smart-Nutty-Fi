import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";

import {
  getLatestRiskConfigSource,
  loadRiskConfig,
  normalizeRiskProfileId,
  resolveRiskConfig,
} from "./config/riskConfig.js";
import { assessTransferRisk, isRiskRuleCode } from "./lib/risk.js";
import {
  getAccountSnapshot,
  getPolicyDataSource,
  getPolicySearchResult,
  getRuntimeDataMode,
  recordRiskLog,
  recordSimulation,
  saveTransfer,
  type PolicyCitation,
} from "./lib/store.js";

const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);

const ai = genkit({
  plugins: geminiConfigured ? [googleAI()] : [],
});

const RiskProfileSchema = z.enum(["conservative", "balanced", "flexible"]);

const PolicyCitationSchema = z.object({
  title: z.string(),
  source: z.string(),
  url: z.string().url(),
});

const RiskRuleHitSchema = z.object({
  code: z.enum([
    "amount_threshold",
    "high_risk_keyword",
    "unknown_payee",
    "low_remaining_balance",
  ]),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["medium", "high"]),
  policyTopics: z.array(z.string()),
});

const AssistantResponseSchema = z.object({
  reply: z.string(),
  intent: z.enum(["transfer_money", "pay_bill", "calculate_cashflow", "unknown"]),
  status: z.enum(["requires_confirmation", "completed", "info", "error"]),
  actionCard: z
    .object({
      kind: z.literal("transfer"),
      recipient: z.string(),
      amount: z.number(),
    })
    .nullable(),
  calmMode: z
    .object({
      active: z.literal(true),
      reasons: z.array(z.string()),
      severity: z.enum(["medium", "high"]),
      ruleHits: z.array(RiskRuleHitSchema),
      policySummary: z.string(),
      citations: z.array(PolicyCitationSchema),
      riskLogId: z.string().nullable(),
      appliedProfile: RiskProfileSchema,
    })
    .nullable(),
  confirmation: z
    .object({
      recipient: z.string(),
      amount: z.number(),
    })
    .nullable(),
});

const ParsedIntentSchema = z.object({
  intent: z.enum(["transfer_money", "pay_bill", "calculate_cashflow", "unknown"]),
  amount: z.number().nullable(),
  recipient: z.string().nullable(),
  biller: z.string().nullable(),
  purchaseName: z.string().nullable(),
});

type AssistantResponse = z.infer<typeof AssistantResponseSchema>;
type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

const CASHFLOW_HINT_PATTERNS = [
  /\bcan i afford\b/i,
  /\bafter bills?\b/i,
  /\bremaining balance\b/i,
  /\bleft after\b/i,
  /\bhow much (?:would )?(?:be )?left\b/i,
  /\bwhat (?:happens|would happen)\b/i,
  /\bif i (?:spend|buy)\b/i,
  /\bcashflow\b/i,
];

const MONEY_MOVEMENT_HINT_PATTERNS = [
  /\btransfer\b/i,
  /\bsend\b/i,
  /\bmove\b/i,
  /\bforward\b/i,
  /\bwire\b/i,
  /\bremit\b/i,
];

const HIGH_RISK_DESTINATION_HINT_PATTERNS = [/\bwallet\b/i, /\bexchange\b/i, /\bcrypto\b/i];

const SCAM_CONTEXT_HINT_PATTERNS = [
  /\burgent(?:ly)?\b/i,
  /\bunlock\b/i,
  /\bprize\b/i,
  /\bclaim\b/i,
  /\brelease\b/i,
  /\bverify\b/i,
];

const KNOWN_BILLERS = [
  {
    pattern: /\bunifi\b/i,
    biller: "Unifi Broadband",
    defaultAmount: 159,
  },
  {
    pattern: /\btnb\b/i,
    biller: "TNB Utilities",
    defaultAmount: 120,
  },
  {
    pattern: /\bmaxis\b/i,
    biller: "Maxis Mobile",
    defaultAmount: 85,
  },
];

const riskCheckTool = ai.defineTool(
  {
    name: "risk_check",
    description:
      "Runs Nutty-Fi's deterministic server-side transfer risk rules. Use this before any money movement.",
    inputSchema: z.object({
      recipient: z.string(),
      amount: z.number(),
      currentBalance: z.number(),
      upcomingBills: z.number(),
      knownPayees: z.array(z.string()),
      riskProfile: RiskProfileSchema.optional(),
    }),
    outputSchema: z.object({
      risky: z.boolean(),
      reasons: z.array(z.string()),
      ruleHits: z.array(RiskRuleHitSchema),
      projectedRemainingBalance: z.number(),
      knownPayee: z.boolean(),
      appliedProfile: RiskProfileSchema,
      thresholds: z.object({
        maxTransferWithoutConfirm: z.number(),
        minBalanceThreshold: z.number(),
      }),
    }),
  },
  async ({ riskProfile, ...input }) => {
    const config = resolveRiskConfig(await loadRiskConfig(), riskProfile ?? undefined);
    return assessTransferRisk(input, config);
  },
);

const searchPolicyGuidelinesTool = ai.defineTool(
  {
    name: "search_policy_guidelines",
    description:
      "Retrieves policy guidance for Calm Mode explanations, preferring seeded or Firestore-backed regulatory snippets before summarising them.",
    inputSchema: z.object({
      query: z.string(),
      topics: z.array(z.string()).optional(),
    }),
    outputSchema: z.object({
      summary: z.string(),
      citations: z.array(PolicyCitationSchema),
      source: z.enum(["firestore", "seed"]),
    }),
  },
  async ({ query, topics }) =>
    getPolicySearchResult({
      query,
      topics,
    }),
);

const transferMoneyTool = ai.defineTool(
  {
    name: "transfer_money",
    description:
      "Executes a transfer only after Nutty-Fi's deterministic server-side risk rules have been checked.",
    inputSchema: z.object({
      recipient: z.string(),
      amount: z.number(),
      acknowledgedRisk: z.boolean(),
      riskProfile: RiskProfileSchema.optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      blocked: z.boolean(),
      message: z.string(),
      transactionId: z.string().nullable(),
      currentBalance: z.number(),
      reasons: z.array(z.string()),
      appliedProfile: RiskProfileSchema,
    }),
  },
  async ({ recipient, amount, acknowledgedRisk, riskProfile }) => {
    const accountSnapshot = await getAccountSnapshot();
    const config = resolveRiskConfig(await loadRiskConfig(), riskProfile ?? undefined);
    const risk = assessTransferRisk(
      {
        recipient,
        amount,
        currentBalance: accountSnapshot.currentBalance,
        upcomingBills: accountSnapshot.upcomingBills,
        knownPayees: accountSnapshot.knownPayees,
      },
      config,
    );

    if (risk.risky && !acknowledgedRisk) {
      return {
        success: false,
        blocked: true,
        message: "This transfer is blocked until the user confirms Calm Mode.",
        transactionId: null,
        currentBalance: accountSnapshot.currentBalance,
        reasons: risk.reasons,
        appliedProfile: risk.appliedProfile,
      };
    }

    const { transaction, currentBalance } = await saveTransfer({
      recipient,
      amount,
      reasons: risk.reasons,
      acknowledgedRisk,
    });

    return {
      success: true,
      blocked: false,
      message: `Transfer complete. RM${amount.toFixed(2)} sent to ${recipient}.`,
      transactionId: transaction.id,
      currentBalance,
      reasons: risk.reasons,
      appliedProfile: risk.appliedProfile,
    };
  },
);

const payBillTool = ai.defineTool(
  {
    name: "pay_bill",
    description: "Acknowledges a recognised bill request without executing a real bill payment.",
    inputSchema: z.object({
      biller: z.string(),
      amount: z.number(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
  async ({ biller, amount }) => ({
    success: true,
    message: createBillReviewReply({ biller, amount }),
  }),
);

const calculateCashflowTool = ai.defineTool(
  {
    name: "calculate_cashflow",
    description: "Calculates the short-term cashflow impact of a planned purchase.",
    inputSchema: z.object({
      amount: z.number(),
      description: z.string(),
    }),
    outputSchema: z.object({
      remainingBalance: z.number(),
      warning: z.boolean(),
      message: z.string(),
    }),
  },
  async ({ amount, description }) => {
    const accountSnapshot = await getAccountSnapshot();
    const remainingBalance = accountSnapshot.currentBalance - accountSnapshot.upcomingBills - amount;
    const warning = remainingBalance < 500;

    await recordSimulation({
      description,
      amount,
      remainingBalance,
      warning,
    });

    return {
      remainingBalance,
      warning,
      message: warning
        ? `After ${description}, you would have RM${remainingBalance.toFixed(
            2,
          )} left after your upcoming bills.`
        : `After ${description}, you would still have RM${remainingBalance.toFixed(
            2,
          )} left after your upcoming bills.`,
    };
  },
);

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractAmount(message: string) {
  const match = message.match(/rm\s*([\d,]+(?:\.\d+)?)/i) ?? message.match(/\b(\d+(?:\.\d+)?)\b/);

  if (!match) {
    return null;
  }

  return Number(match[1].replace(/,/g, ""));
}

function matchesAnyPattern(patterns: RegExp[], value: string) {
  return patterns.some((pattern) => pattern.test(value));
}

function findKnownBiller(message: string) {
  return KNOWN_BILLERS.find(({ pattern }) => pattern.test(message)) ?? null;
}

function extractTransferRecipient(message: string) {
  const recipientMatch =
    message.match(
      /\b(?:transfer|send|move|forward|wire|remit)\b.*?\b(?:to|into)\s+(.+?)(?=\s+to\s+(?:unlock|claim|release|get|receive)\b|\s+(?:because|after|before|so that|so|while)\b|[.!?]|$)/i,
    ) ??
    message.match(
      /\b(?:to|into)\s+(.+?)(?=\s+to\s+(?:unlock|claim|release|get|receive)\b|\s+(?:because|after|before|so that|so|while)\b|[.!?]|$)/i,
    ) ??
    message.match(/\b(?:to|into)\s+(.+)$/i);

  if (!recipientMatch) {
    if (/\bwallet\b/i.test(message)) {
      return "Wallet Destination";
    }

    if (/\bcrypto\b/i.test(message) || /\bexchange\b/i.test(message)) {
      return "Crypto Exchange";
    }

    return null;
  }

  const normalizedRecipient = recipientMatch[1]
    .replace(/\b(?:right now|immediately)\b/gi, "")
    .trim();

  return normalizedRecipient ? titleCase(normalizedRecipient) : null;
}

export function parseIntentDeterministically(message: string): ParsedIntent {
  const lowerMessage = message.toLowerCase();
  const amount = extractAmount(message);
  const knownBiller = findKnownBiller(message);

  if (matchesAnyPattern(CASHFLOW_HINT_PATTERNS, message)) {
    return {
      intent: "calculate_cashflow",
      amount,
      recipient: null,
      biller: null,
      purchaseName: "this spend",
    };
  }

  if (knownBiller || lowerMessage.includes("bill")) {
    return {
      intent: "pay_bill",
      amount: amount ?? knownBiller?.defaultAmount ?? 159,
      recipient: null,
      biller: knownBiller?.biller ?? "Utility Bill",
      purchaseName: null,
    };
  }

  const looksLikeTransfer =
    matchesAnyPattern(MONEY_MOVEMENT_HINT_PATTERNS, message) ||
    (amount !== null &&
      (matchesAnyPattern(HIGH_RISK_DESTINATION_HINT_PATTERNS, message) ||
        matchesAnyPattern(SCAM_CONTEXT_HINT_PATTERNS, message)));

  if (looksLikeTransfer) {
    return {
      intent: "transfer_money",
      amount,
      recipient: extractTransferRecipient(message),
      biller: null,
      purchaseName: null,
    };
  }

  return {
    intent: "unknown",
    amount: null,
    recipient: null,
    biller: null,
    purchaseName: null,
  };
}

function fallbackParseIntent(message: string): ParsedIntent {
  const deterministicIntent = parseIntentDeterministically(message);

  if (deterministicIntent.intent !== "unknown") {
    return deterministicIntent;
  }

  const lowerMessage = message.toLowerCase();
  const amount = extractAmount(message);

  if (lowerMessage.includes("transfer")) {
    const recipientMatch = message.match(/\bto\s+(.+)$/i);

    return {
      intent: "transfer_money",
      amount,
      recipient: recipientMatch ? titleCase(recipientMatch[1].trim()) : null,
      biller: null,
      purchaseName: null,
    };
  }

  if (lowerMessage.includes("bill") || lowerMessage.includes("unifi")) {
    return {
      intent: "pay_bill",
      amount: amount ?? 159,
      recipient: null,
      biller: lowerMessage.includes("unifi") ? "Unifi Broadband" : "Utility Bill",
      purchaseName: null,
    };
  }

  if (lowerMessage.includes("if i buy") || lowerMessage.includes("what happens")) {
    return {
      intent: "calculate_cashflow",
      amount,
      recipient: null,
      biller: null,
      purchaseName: "this purchase",
    };
  }

  return {
    intent: "unknown",
    amount: null,
    recipient: null,
    biller: null,
    purchaseName: null,
  };
}

async function parseIntent(message: string): Promise<ParsedIntent> {
  if (!geminiConfigured) {
    return fallbackParseIntent(message);
  }

  try {
    const response = await ai.generate({
      model: googleAI.model("gemini-2.5-flash"),
      prompt: `
You are parsing a fintech request for Nutty-Fi.
Return structured JSON only.
Supported intents:
- transfer_money
- pay_bill
- calculate_cashflow
- unknown

Interpret amounts as Malaysian Ringgit.
For transfer_money, fill recipient and amount when available.
For pay_bill, fill biller and amount when available.
Affordability or remaining-balance questions belong to calculate_cashflow, not pay_bill.
Scam-like requests to move money to wallets, exchanges, or prize-unlock destinations belong to transfer_money.
For calculate_cashflow, fill purchaseName and amount when available.

User message: ${message}
      `,
      output: {
        schema: ParsedIntentSchema,
      },
      config: {
        temperature: 0.1,
      },
    });

    const deterministicIntent = parseIntentDeterministically(message);
    if (deterministicIntent.intent !== "unknown") {
      return deterministicIntent;
    }

    return response.output ?? fallbackParseIntent(message);
  } catch {
    return fallbackParseIntent(message);
  }
}

function createCalmModeFallbackReply(input: {
  recipient: string;
  amount: number;
  reasons: string[];
  policySummary: string;
  citations: PolicyCitation[];
}) {
  const primaryReason = input.reasons[0] ?? "this transfer needs review";
  const primaryCitation = formatCitationLabel(input.citations[0]);

  return `Nutty paused RM${input.amount.toFixed(
    2,
  )} to ${input.recipient} because ${primaryReason}. Malaysia context: ${input.policySummary} Continue only if you have independently verified the recipient using ${primaryCitation}.`;
}

export function formatCitationLabel(citation?: PolicyCitation) {
  if (!citation) {
    return "Malaysia public guidance";
  }

  return `${citation.title} from ${citation.source}`;
}

export function createBillReviewReply(input: { biller: string; amount: number }) {
  return `Nutty recognised a bill request for RM${input.amount.toFixed(
    2,
  )} to ${input.biller}, but this demo does not execute bill payments. Use the what-if check to review the impact before you pay it elsewhere.`;
}

async function generateCalmModeReply(input: {
  recipient: string;
  amount: number;
  reasons: string[];
  policySummary: string;
  citations: PolicyCitation[];
  explanationTone: "cautious" | "balanced" | "light";
}) {
  if (!geminiConfigured) {
    return createCalmModeFallbackReply(input);
  }

  try {
    const response = await ai.generate({
      model: googleAI.model("gemini-2.5-flash"),
      prompt: `
You are Nutty-Fi's Calm Mode explainer.
Write exactly 2 short sentences under 75 words total.
Sentence 1: explain the strongest reason this transfer was paused.
Sentence 2: give the Malaysian policy context in plain language, name the most relevant cited source briefly, and tell the user to continue only if they have independently verified the transfer.
Be clear, calm, and specific.
Do not imply legal advice, official approval, or full regulatory coverage.

Transfer recipient: ${input.recipient}
Transfer amount: RM${input.amount.toFixed(2)}
Explanation tone: ${input.explanationTone}
Risk reasons:
${input.reasons.map((reason) => `- ${reason}`).join("\n")}

Policy summary:
${input.policySummary}

Citations to reference briefly:
${input.citations.map((citation) => `- ${citation.title} (${citation.source})`).join("\n")}
      `,
      config: {
        temperature: 0.2,
      },
    });

    return response.text?.trim() || createCalmModeFallbackReply(input);
  } catch {
    return createCalmModeFallbackReply(input);
  }
}

function buildErrorResponse(reply: string): AssistantResponse {
  return {
    reply,
    intent: "unknown",
    status: "error",
    actionCard: null,
    calmMode: null,
    confirmation: null,
  };
}

function resolveRequestedProfile(riskProfile: unknown) {
  return normalizeRiskProfileId(riskProfile);
}

export const assistantFlow = ai.defineFlow(
  {
    name: "nuttyAssistantFlow",
    inputSchema: z.object({
      message: z.string(),
      riskProfile: RiskProfileSchema.optional(),
    }),
    outputSchema: AssistantResponseSchema,
  },
  async ({ message, riskProfile }): Promise<AssistantResponse> => {
    const parsedIntent = await parseIntent(message);
    const requestedProfile = resolveRequestedProfile(riskProfile);

    if (parsedIntent.intent === "transfer_money") {
      if (!parsedIntent.recipient || !parsedIntent.amount) {
        return {
          reply: "Tell me who the transfer is for and the amount, for example: Transfer RM50 to Ali.",
          intent: "transfer_money",
          status: "info",
          actionCard: null,
          calmMode: null,
          confirmation: null,
        };
      }

      const accountSnapshot = await getAccountSnapshot();
      const riskCheck = await riskCheckTool.run({
        recipient: parsedIntent.recipient,
        amount: parsedIntent.amount,
        currentBalance: accountSnapshot.currentBalance,
        upcomingBills: accountSnapshot.upcomingBills,
        knownPayees: accountSnapshot.knownPayees,
        riskProfile: requestedProfile ?? undefined,
      });

      if (riskCheck.result.risky) {
        const policySearch = await searchPolicyGuidelinesTool.run({
          query: `Transfer RM${parsedIntent.amount.toFixed(2)} to ${parsedIntent.recipient}`,
          topics: Array.from(
            new Set(riskCheck.result.ruleHits.flatMap((ruleHit) => ruleHit.policyTopics)),
          ),
        });

        const activeConfig = resolveRiskConfig(await loadRiskConfig(), riskCheck.result.appliedProfile);
        const reply = await generateCalmModeReply({
          recipient: parsedIntent.recipient,
          amount: parsedIntent.amount,
          reasons: riskCheck.result.reasons,
          policySummary: policySearch.result.summary,
          citations: policySearch.result.citations,
          explanationTone: activeConfig.explanationTone,
        });

        const riskLog = await recordRiskLog({
          eventType: "risk_triggered",
          recipient: parsedIntent.recipient,
          amount: parsedIntent.amount,
          ruleCodes: riskCheck.result.ruleHits.map((ruleHit) => ruleHit.code),
          riskProfile: riskCheck.result.appliedProfile,
          message: reply,
          ruleHits: riskCheck.result.ruleHits,
          policySummary: policySearch.result.summary,
          citations: policySearch.result.citations,
        });

        return {
          reply,
          intent: "transfer_money",
          status: "requires_confirmation",
          actionCard: {
            kind: "transfer",
            recipient: parsedIntent.recipient,
            amount: parsedIntent.amount,
          },
          calmMode: {
            active: true,
            reasons: riskCheck.result.reasons,
            severity: riskCheck.result.ruleHits.some((ruleHit) => ruleHit.severity === "high")
              ? "high"
              : "medium",
            ruleHits: riskCheck.result.ruleHits,
            policySummary: policySearch.result.summary,
            citations: policySearch.result.citations,
            riskLogId: riskLog.id,
            appliedProfile: riskCheck.result.appliedProfile,
          },
          confirmation: {
            recipient: parsedIntent.recipient,
            amount: parsedIntent.amount,
          },
        };
      }

      const transferResult = await transferMoneyTool.run({
        recipient: parsedIntent.recipient,
        amount: parsedIntent.amount,
        acknowledgedRisk: false,
        riskProfile: requestedProfile ?? undefined,
      });

      if (!transferResult.result.success) {
        return buildErrorResponse(transferResult.result.message);
      }

      return {
        reply: transferResult.result.message,
        intent: "transfer_money",
        status: "completed",
        actionCard: {
          kind: "transfer",
          recipient: parsedIntent.recipient,
          amount: parsedIntent.amount,
        },
        calmMode: null,
        confirmation: null,
      };
    }

    if (parsedIntent.intent === "pay_bill") {
      const biller = parsedIntent.biller ?? "Utility Bill";
      const amount = parsedIntent.amount ?? 159;
      const billResult = await payBillTool.run({
        biller,
        amount,
      });

      return {
        reply: billResult.result.message,
        intent: "pay_bill",
        status: "info",
        actionCard: null,
        calmMode: null,
        confirmation: null,
      };
    }

    if (parsedIntent.intent === "calculate_cashflow") {
      if (!parsedIntent.amount) {
        return {
          reply: "Tell me the purchase amount and I will estimate what is left after your upcoming bills.",
          intent: "calculate_cashflow",
          status: "info",
          actionCard: null,
          calmMode: null,
          confirmation: null,
        };
      }

      const simulationResult = await calculateCashflowTool.run({
        amount: parsedIntent.amount,
        description: parsedIntent.purchaseName ?? "this purchase",
      });

      return {
        reply: simulationResult.result.message,
        intent: "calculate_cashflow",
        status: "info",
        actionCard: null,
        calmMode: null,
        confirmation: null,
      };
    }

    return {
      reply: "I can help with transfer safety, bill review, or a what-if cashflow scenario.",
      intent: "unknown",
      status: "info",
      actionCard: null,
      calmMode: null,
      confirmation: null,
    };
  },
);

export async function confirmTransfer(input: {
  recipient: string;
  amount: number;
  acknowledgedRisk: boolean;
  riskLogId?: string | null;
  ruleCodes?: string[];
  riskProfile?: string | null;
}): Promise<AssistantResponse> {
  if (!input.acknowledgedRisk) {
    return buildErrorResponse("Calm Mode confirmation is required before this transfer can proceed.");
  }

  const requestedProfile = resolveRequestedProfile(input.riskProfile);
  const transferResult = await transferMoneyTool.run({
    recipient: input.recipient,
    amount: input.amount,
    acknowledgedRisk: true,
    riskProfile: requestedProfile ?? undefined,
  });

  if (!transferResult.result.success) {
    return buildErrorResponse(transferResult.result.message);
  }

  await recordRiskLog({
    eventType: "risk_confirmed",
    recipient: input.recipient,
    amount: input.amount,
    ruleCodes: (input.ruleCodes ?? []).filter(isRiskRuleCode),
    riskProfile: transferResult.result.appliedProfile,
    relatedRiskLogId: input.riskLogId ?? undefined,
    message: "User reviewed Calm Mode and continued with the transfer.",
  });

  return {
    reply: `${transferResult.result.message} Nutty logged your risk acknowledgement.`,
    intent: "transfer_money",
    status: "completed",
    actionCard: {
      kind: "transfer",
      recipient: input.recipient,
      amount: input.amount,
    },
    calmMode: null,
    confirmation: null,
  };
}

export async function cancelTransfer(input: {
  recipient: string;
  amount: number;
  riskLogId?: string | null;
  ruleCodes?: string[];
  riskProfile?: string | null;
}): Promise<AssistantResponse> {
  const config = resolveRiskConfig(await loadRiskConfig(), resolveRequestedProfile(input.riskProfile));

  await recordRiskLog({
    eventType: "risk_cancelled",
    recipient: input.recipient,
    amount: input.amount,
    ruleCodes: (input.ruleCodes ?? []).filter(isRiskRuleCode),
    riskProfile: config.requestedProfile,
    relatedRiskLogId: input.riskLogId ?? undefined,
    message: "User paused the transfer instead of continuing immediately.",
  });

  return {
    reply: "Nutty paused the transfer. No money moved. Review the recipient and continue later only if you still trust it.",
    intent: "transfer_money",
    status: "info",
    actionCard: null,
    calmMode: null,
    confirmation: null,
  };
}

export function getBackendStatus() {
  return {
    gemini: geminiConfigured ? "configured" : "missing",
    dataMode: getRuntimeDataMode(),
    policySource: getPolicyDataSource(),
    riskConfigSource: getLatestRiskConfigSource(),
  };
}
