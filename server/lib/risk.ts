export type RiskCheckInput = {
  recipient: string;
  amount: number;
  currentBalance: number;
  upcomingBills: number;
  knownPayees: string[];
};

export type RiskAssessment = {
  risky: boolean;
  reasons: string[];
  projectedRemainingBalance: number;
  knownPayee: boolean;
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

export function assessTransferRisk(input: RiskCheckInput): RiskAssessment {
  const reasons: string[] = [];
  const knownPayee = isKnownPayee(input.recipient, input.knownPayees);
  const projectedRemainingBalance = input.currentBalance - input.upcomingBills - input.amount;

  if (input.amount >= 1000) {
    reasons.push("This transfer is above your RM1,000 review threshold.");
  }

  if (/\b(crypto|exchange)\b/i.test(input.recipient)) {
    reasons.push("The destination looks like a crypto or exchange payee.");
  }

  if (!knownPayee) {
    reasons.push("This recipient is not in your known payee list.");
  }

  if (projectedRemainingBalance < 500) {
    reasons.push("After this transfer and your upcoming bills, you would have less than RM500 left.");
  }

  return {
    risky: reasons.length > 0,
    reasons,
    projectedRemainingBalance,
    knownPayee,
  };
}
