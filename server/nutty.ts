import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";

import { assessTransferRisk } from "./lib/risk.js";
import {
  getAccountSnapshot,
  getPolicySearchResult,
  getRuntimeDataMode,
  recordRiskEvent,
  recordSimulation,
  saveTransfer,
} from "./lib/store.js";

const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);

const ai = genkit({
  plugins: geminiConfigured ? [googleAI()] : [],
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
      severity: z.literal("high"),
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
    }),
    outputSchema: z.object({
      risky: z.boolean(),
      reasons: z.array(z.string()),
      projectedRemainingBalance: z.number(),
      knownPayee: z.boolean(),
    }),
  },
  async (input) => assessTransferRisk(input),
);

const searchPolicyGuidelinesTool = ai.defineTool(
  {
    name: "search_policy_guidelines",
    description:
      "Retrieves financial risk and policy guidance for Calm Mode explanations, including AML and scam-prevention context.",
    inputSchema: z.object({
      query: z.string(),
    }),
    outputSchema: z.object({
      guidance: z.string(),
      citations: z.array(z.string()),
    }),
  },
  async ({ query }) => getPolicySearchResult(query),
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
    }),
    outputSchema: z.object({
      success: z.boolean(),
      blocked: z.boolean(),
      message: z.string(),
      transactionId: z.string().nullable(),
      currentBalance: z.number(),
      reasons: z.array(z.string()),
    }),
  },
  async ({ recipient, amount, acknowledgedRisk }) => {
    const accountSnapshot = await getAccountSnapshot();
    const risk = assessTransferRisk({
      recipient,
      amount,
      currentBalance: accountSnapshot.currentBalance,
      upcomingBills: accountSnapshot.upcomingBills,
      knownPayees: accountSnapshot.knownPayees,
    });

    if (risk.risky && !acknowledgedRisk) {
      return {
        success: false,
        blocked: true,
        message: "This transfer is blocked until the user confirms Calm Mode.",
        transactionId: null,
        currentBalance: accountSnapshot.currentBalance,
        reasons: risk.reasons,
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
    };
  },
);

const payBillTool = ai.defineTool(
  {
    name: "pay_bill",
    description: "Handles a simple bill payment response for known Malaysian utility-style bills.",
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
    message: `Nutty is ready to pay RM${amount.toFixed(2)} to ${biller}.`,
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

function fallbackParseIntent(message: string): ParsedIntent {
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

    return response.output ?? fallbackParseIntent(message);
  } catch {
    return fallbackParseIntent(message);
  }
}

async function generateCalmModeReply(input: {
  message: string;
  recipient: string;
  amount: number;
  reasons: string[];
}) {
  if (!geminiConfigured) {
    const searchResult = await searchPolicyGuidelinesTool.run({
      query: `Transfer to ${input.recipient} for RM${input.amount.toFixed(2)}`,
    });

    return `Nutty paused this transfer because ${input.reasons.join(
      " ",
    )} Policy context: ${searchResult.result.guidance}`;
  }

  try {
    const response = await ai.generate({
      model: googleAI.model("gemini-2.5-flash"),
      prompt: `
You are Nutty-Fi's Calm Mode explainer.
You must call the search_policy_guidelines tool exactly once before writing the answer.
Keep the reply under 70 words.
Explain clearly why the transfer was paused, mention the policy guidance briefly, and end by asking the user to pause or continue only if they understand the risk.

Original user message: ${input.message}
Recipient: ${input.recipient}
Amount: RM${input.amount.toFixed(2)}
Risk reasons:
${input.reasons.map((reason) => `- ${reason}`).join("\n")}
      `,
      tools: [searchPolicyGuidelinesTool],
      maxTurns: 3,
      config: {
        temperature: 0.2,
      },
    });

    return (
      response.text ??
      `Nutty paused this transfer because ${input.reasons.join(" ")} Please review the risk before continuing.`
    );
  } catch {
    const searchResult = await searchPolicyGuidelinesTool.run({
      query: `Transfer to ${input.recipient} for RM${input.amount.toFixed(2)}`,
    });

    return `Nutty paused this transfer because ${input.reasons.join(
      " ",
    )} Policy context: ${searchResult.result.guidance}`;
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

export const assistantFlow = ai.defineFlow(
  {
    name: "nuttyAssistantFlow",
    inputSchema: z.object({
      message: z.string(),
    }),
    outputSchema: AssistantResponseSchema,
  },
  async ({ message }): Promise<AssistantResponse> => {
    const parsedIntent = await parseIntent(message);

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
      });

      if (riskCheck.result.risky) {
        const reply = await generateCalmModeReply({
          message,
          recipient: parsedIntent.recipient,
          amount: parsedIntent.amount,
          reasons: riskCheck.result.reasons,
        });

        await recordRiskEvent({
          recipient: parsedIntent.recipient,
          amount: parsedIntent.amount,
          reasons: riskCheck.result.reasons,
          message: reply,
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
            severity: "high",
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
      reply: "I can help you transfer money, pay a bill, or check a what-if cashflow scenario.",
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
}): Promise<AssistantResponse> {
  if (!input.acknowledgedRisk) {
    return buildErrorResponse("Calm Mode confirmation is required before this transfer can proceed.");
  }

  const transferResult = await transferMoneyTool.run({
    recipient: input.recipient,
    amount: input.amount,
    acknowledgedRisk: true,
  });

  if (!transferResult.result.success) {
    return buildErrorResponse(transferResult.result.message);
  }

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

export function getBackendStatus() {
  return {
    gemini: geminiConfigured ? "configured" : "missing",
    dataMode: getRuntimeDataMode(),
  };
}
