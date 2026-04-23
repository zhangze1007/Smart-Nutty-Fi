import type { ResolvedRiskConfig } from "../config/riskConfig.js";
import type { RiskProfileId } from "../config/riskConfig.js";

export type RiskCheckInput = {
  recipient: string;
  amount: number;
  currentBalance: number;
  upcomingBills: number;
  knownPayees: string[];
};

export type RiskRuleCode =
  | "amount_threshold"
  | "high_risk_keyword"
  | "unknown_payee"
  | "low_remaining_balance";

const VALID_RISK_RULE_CODES: RiskRuleCode[] = [
  "amount_threshold",
  "high_risk_keyword",
  "unknown_payee",
  "low_remaining_balance",
];

export type RiskRuleHit = {
  code: RiskRuleCode;
  title: string;
  detail: string;
  severity: "medium" | "high";
  policyTopics: string[];
};

export type RiskTriggerFlags = {
  first_time_payee: boolean;
  high_amount: boolean;
  thin_buffer: boolean;
  suspicious_destination: boolean;
};

export type RiskTriggerReason = keyof RiskTriggerFlags;

export type RecipientAssurance = {
  status: "known_payee" | "not_previously_verified";
  label: string;
  detail: string;
  guidance: string;
};

export type RiskAssessment = {
  risky: boolean;
  reasons: string[];
  ruleHits: RiskRuleHit[];
  projectedRemainingBalance: number;
  knownPayee: boolean;
  triggerFlags: RiskTriggerFlags;
  triggerReasons: RiskTriggerReason[];
  recipientAssurance: RecipientAssurance;
  appliedProfile: RiskProfileId;
  thresholds: {
    maxTransferWithoutConfirm: number;
    minBalanceThreshold: number;
  };
};

function normalizePayee(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isKnownPayee(recipient: string, knownPayees: string[]) {
  const normalizedRecipient = normalizePayee(recipient);

  return knownPayees.some((knownPayee) => {
    const normalizedKnownPayee = normalizePayee(knownPayee);

    return (
      normalizedKnownPayee === normalizedRecipient ||
      normalizedKnownPayee.includes(normalizedRecipient) ||
      normalizedRecipient.includes(normalizedKnownPayee)
    );
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function findMatchedKeyword(recipient: string, highRiskKeywords: string[]) {
  const normalizedRecipient = normalizePayee(recipient);

  return highRiskKeywords.find((keyword) => normalizedRecipient.includes(normalizePayee(keyword))) ?? null;
}

export function isRiskRuleCode(value: string): value is RiskRuleCode {
  return VALID_RISK_RULE_CODES.includes(value as RiskRuleCode);
}

export function getTriggerFlagsFromRuleCodes(ruleCodes: RiskRuleCode[]): RiskTriggerFlags {
  return {
    first_time_payee: ruleCodes.includes("unknown_payee"),
    high_amount: ruleCodes.includes("amount_threshold"),
    thin_buffer: ruleCodes.includes("low_remaining_balance"),
    suspicious_destination: ruleCodes.includes("high_risk_keyword"),
  };
}

export function getTriggerReasonsFromFlags(flags: RiskTriggerFlags): RiskTriggerReason[] {
  return (Object.entries(flags) as Array<[RiskTriggerReason, boolean]>)
    .filter(([, isTriggered]) => isTriggered)
    .map(([reason]) => reason);
}

function createRecipientAssurance(knownPayee: boolean): RecipientAssurance {
  if (knownPayee) {
    return {
      status: "known_payee",
      label: "Known payee",
      detail: "This recipient appears in the demo known-payee list.",
      guidance: "Still confirm the amount and purpose before sending.",
    };
  }

  return {
    status: "not_previously_verified",
    label: "Recipient not previously verified",
    detail: "This recipient is not in the demo known-payee list. Nutty has not proven the account is fraudulent.",
    guidance: "Verify independently using an official app, website, or phone number before continuing.",
  };
}

export function assessTransferRisk(
  input: RiskCheckInput,
  config: ResolvedRiskConfig,
): RiskAssessment {
  const ruleHits: RiskRuleHit[] = [];
  const knownPayee = isKnownPayee(input.recipient, input.knownPayees);
  const projectedRemainingBalance = input.currentBalance - input.upcomingBills - input.amount;
  const matchedKeyword = findMatchedKeyword(input.recipient, config.highRiskKeywords);

  if (input.amount >= config.maxTransferWithoutConfirm) {
    ruleHits.push({
      code: "amount_threshold",
      title: "High-value transfer needs review",
      detail: `This transfer is above the ${formatCurrency(
        config.maxTransferWithoutConfirm,
      )} review threshold for the ${config.requestedProfile} pilot profile.`,
      severity: "medium",
      policyTopics: ["aml_reporting", "scam_verification"],
    });
  }

  if (matchedKeyword) {
    ruleHits.push({
      code: "high_risk_keyword",
      title: "Suspicious destination category",
      detail: `The recipient name includes "${matchedKeyword}", a destination category Nutty reviews before funds move.`,
      severity: config.highRiskKeywordSeverity,
      policyTopics: ["financial_crime", "consumer_alert", "scam_verification"],
    });
  }

  const shouldReviewUnknownPayee =
    config.unknownPayeeRequiresReview &&
    !knownPayee &&
    input.amount >= config.unknownPayeeMinimumAmount;

  if (shouldReviewUnknownPayee) {
    ruleHits.push({
      code: "unknown_payee",
      title: "Recipient not previously verified",
      detail:
        config.unknownPayeeMinimumAmount > 0
          ? `This ${config.requestedProfile} profile pauses first-time recipients from ${formatCurrency(
              config.unknownPayeeMinimumAmount,
            )} upward so the recipient can be verified independently before money moves.`
          : `This ${config.requestedProfile} profile pauses first-time recipients so the recipient can be verified independently before money moves.`,
      severity: config.unknownPayeeSeverity,
      policyTopics: ["money_mule", "unknown_payee", "scam_verification"],
    });
  }

  if (projectedRemainingBalance < config.minBalanceThreshold) {
    ruleHits.push({
      code: "low_remaining_balance",
      title: "Transfer leaves a thin cash buffer",
      detail: `After this transfer and upcoming bills, the projected remaining balance would drop below ${formatCurrency(
        config.minBalanceThreshold,
      )}.`,
      severity: "medium",
      policyTopics: ["cash_buffer", "consumer_protection"],
    });
  }

  const triggerFlags: RiskTriggerFlags = {
    first_time_payee: !knownPayee,
    high_amount: input.amount >= config.maxTransferWithoutConfirm,
    thin_buffer: projectedRemainingBalance < config.minBalanceThreshold,
    suspicious_destination: Boolean(matchedKeyword),
  };
  const triggeredFlags = getTriggerFlagsFromRuleCodes(ruleHits.map((ruleHit) => ruleHit.code));

  return {
    risky: ruleHits.length > 0,
    reasons: ruleHits.map((ruleHit) => ruleHit.detail),
    ruleHits,
    projectedRemainingBalance,
    knownPayee,
    triggerFlags,
    triggerReasons: getTriggerReasonsFromFlags(triggeredFlags),
    recipientAssurance: createRecipientAssurance(knownPayee),
    appliedProfile: config.requestedProfile,
    thresholds: {
      maxTransferWithoutConfirm: config.maxTransferWithoutConfirm,
      minBalanceThreshold: config.minBalanceThreshold,
    },
  };
}
