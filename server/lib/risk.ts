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

export type RiskAssessment = {
  risky: boolean;
  reasons: string[];
  ruleHits: RiskRuleHit[];
  projectedRemainingBalance: number;
  knownPayee: boolean;
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
      title: "Transfer exceeds the review threshold",
      detail: `This transfer is above the ${formatCurrency(
        config.maxTransferWithoutConfirm,
      )} review threshold for the ${config.requestedProfile} risk profile.`,
      severity: "medium",
      policyTopics: ["aml_reporting", "scam_verification"],
    });
  }

  if (matchedKeyword) {
    ruleHits.push({
      code: "high_risk_keyword",
      title: "Destination looks higher risk",
      detail: `The recipient name includes "${matchedKeyword}", which Nutty treats as a higher-risk keyword that should be reviewed before funds move.`,
      severity: "high",
      policyTopics: ["financial_crime", "consumer_alert", "scam_verification"],
    });
  }

  if (config.unknownPayeeRequiresReview && !knownPayee) {
    ruleHits.push({
      code: "unknown_payee",
      title: "Recipient is not in the known payee list",
      detail: "First-time or unfamiliar recipients are paused so the user can verify the destination before sending money.",
      severity: "medium",
      policyTopics: ["money_mule", "unknown_payee", "scam_verification"],
    });
  }

  if (projectedRemainingBalance < config.minBalanceThreshold) {
    ruleHits.push({
      code: "low_remaining_balance",
      title: "Transfer leaves a low remaining balance",
      detail: `After this transfer and upcoming bills, the projected remaining balance would drop below ${formatCurrency(
        config.minBalanceThreshold,
      )}.`,
      severity: "medium",
      policyTopics: ["cash_buffer", "consumer_protection"],
    });
  }

  return {
    risky: ruleHits.length > 0,
    reasons: ruleHits.map((ruleHit) => ruleHit.detail),
    ruleHits,
    projectedRemainingBalance,
    knownPayee,
    appliedProfile: config.requestedProfile,
    thresholds: {
      maxTransferWithoutConfirm: config.maxTransferWithoutConfirm,
      minBalanceThreshold: config.minBalanceThreshold,
    },
  };
}
