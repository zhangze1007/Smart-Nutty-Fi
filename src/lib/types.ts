export type AssistantIntent = "transfer_money" | "pay_bill" | "calculate_cashflow" | "unknown";
export type AssistantStatus = "requires_confirmation" | "completed" | "info" | "error";
export type RiskProfileId = "conservative" | "balanced" | "flexible";
export type TextScale = "standard" | "large";
export type RiskRuleCode =
  | "amount_threshold"
  | "high_risk_keyword"
  | "unknown_payee"
  | "low_remaining_balance";

export type PolicyCitation = {
  title: string;
  source: string;
  url: string;
};

export type RiskRuleHit = {
  code: RiskRuleCode;
  title: string;
  detail: string;
  severity: "medium" | "high";
  policyTopics: string[];
};

export type AssistantResponse = {
  reply: string;
  intent: AssistantIntent;
  status: AssistantStatus;
  actionCard: null | {
    kind: "transfer";
    recipient: string;
    amount: number;
  };
  calmMode: null | {
    active: true;
    reasons: string[];
    severity: "medium" | "high";
    ruleHits: RiskRuleHit[];
    policySummary: string;
    citations: PolicyCitation[];
    riskLogId: string | null;
    appliedProfile: RiskProfileId;
  };
  confirmation: null | {
    recipient: string;
    amount: number;
  };
};

export type TransferResolutionEvent = {
  id: string;
  response: AssistantResponse;
};

export type RiskPrompt = {
  amount: number;
  recipient: string;
  severity: "medium" | "high";
  reasons: string[];
  ruleHits: RiskRuleHit[];
  citations: PolicyCitation[];
  policySummary: string;
  riskLogId: string | null;
  appliedProfile: RiskProfileId;
};

export type PolicyDocumentSummary = {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  jurisdiction: string;
  summary: string;
  topics: string[];
};

export type PolicyContextData = {
  source: "firestore" | "seed";
  documents: PolicyDocumentSummary[];
  latestTriggeredReview: null | {
    id: string;
    recipient: string;
    amount: number;
    riskProfile: RiskProfileId;
    createdAt: string;
    ruleHits: RiskRuleHit[];
    policySummary: string;
    citations: PolicyCitation[];
  };
};
