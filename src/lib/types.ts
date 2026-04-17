export type AssistantIntent = "transfer_money" | "pay_bill" | "calculate_cashflow" | "unknown";
export type AssistantStatus = "requires_confirmation" | "completed" | "info" | "error";

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
    severity: "high";
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
  reasons: string[];
};
