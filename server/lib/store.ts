import { randomUUID } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";

import {
  createMockDashboardData,
  mockPolicyGuidelines,
  type AppTransaction,
} from "../../src/data/mockTransactions.js";
import { getAdminFirestore } from "./firebaseAdmin.js";

type RiskEvent = {
  id: string;
  recipient: string;
  amount: number;
  reasons: string[];
  message: string;
  createdAt: string;
};

type SimulationEvent = {
  id: string;
  description: string;
  amount: number;
  remainingBalance: number;
  warning: boolean;
  createdAt: string;
};

const memoryState = {
  dashboard: createMockDashboardData(),
  riskEvents: [] as RiskEvent[],
  simulations: [] as SimulationEvent[],
};

function createDateLabel(date: Date) {
  return `Today, ${new Intl.DateTimeFormat("en-MY", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)}`;
}

export async function getAccountSnapshot() {
  const db = getAdminFirestore();

  if (!db) {
    return {
      currentBalance: memoryState.dashboard.currentBalance,
      upcomingBills: memoryState.dashboard.upcomingBills,
      knownPayees: [...memoryState.dashboard.knownPayees],
    };
  }

  try {
    const snapshot = await db.doc("appState/demo").get();

    if (!snapshot.exists) {
      return {
        currentBalance: memoryState.dashboard.currentBalance,
        upcomingBills: memoryState.dashboard.upcomingBills,
        knownPayees: [...memoryState.dashboard.knownPayees],
      };
    }

    const data = snapshot.data() ?? {};

    return {
      currentBalance:
        typeof data.currentBalance === "number"
          ? data.currentBalance
          : memoryState.dashboard.currentBalance,
      upcomingBills:
        typeof data.upcomingBills === "number"
          ? data.upcomingBills
          : memoryState.dashboard.upcomingBills,
      knownPayees:
        Array.isArray(data.knownPayees) && data.knownPayees.every((payee) => typeof payee === "string")
          ? [...data.knownPayees]
          : [...memoryState.dashboard.knownPayees],
    };
  } catch {
    return {
      currentBalance: memoryState.dashboard.currentBalance,
      upcomingBills: memoryState.dashboard.upcomingBills,
      knownPayees: [...memoryState.dashboard.knownPayees],
    };
  }
}

export async function recordRiskEvent(input: Omit<RiskEvent, "id" | "createdAt">) {
  const riskEvent: RiskEvent = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };

  memoryState.riskEvents.unshift(riskEvent);

  const db = getAdminFirestore();
  if (db) {
    try {
      await db.collection("riskEvents").doc(riskEvent.id).set(riskEvent);
    } catch {
      // Fall back to in-memory state only.
    }
  }

  return riskEvent;
}

export async function recordSimulation(input: Omit<SimulationEvent, "id" | "createdAt">) {
  const simulationEvent: SimulationEvent = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };

  memoryState.simulations.unshift(simulationEvent);

  const db = getAdminFirestore();
  if (db) {
    try {
      await db.collection("simulations").doc(simulationEvent.id).set(simulationEvent);
    } catch {
      // Fall back to in-memory state only.
    }
  }

  return simulationEvent;
}

export async function saveTransfer(input: {
  recipient: string;
  amount: number;
  reasons: string[];
  acknowledgedRisk: boolean;
}) {
  const baseSnapshot = await getAccountSnapshot();
  const createdAt = new Date();
  const nextBalance = baseSnapshot.currentBalance - input.amount;
  const nextKnownPayees = Array.from(new Set([...baseSnapshot.knownPayees, input.recipient]));

  const transaction: AppTransaction = {
    id: randomUUID(),
    title: input.recipient,
    category: "Transfer",
    amount: -input.amount,
    date: createDateLabel(createdAt),
    createdAt: createdAt.toISOString(),
    iconKey: "transfer",
    colorKey: input.reasons.length ? "warning" : "primary",
    recipient: input.recipient,
    status: input.acknowledgedRisk ? "reviewed" : "completed",
  };

  memoryState.dashboard.currentBalance = nextBalance;
  memoryState.dashboard.knownPayees = nextKnownPayees;
  memoryState.dashboard.transactions = [transaction, ...memoryState.dashboard.transactions].slice(0, 20);

  const db = getAdminFirestore();
  if (db) {
    try {
      await db.collection("transactions").doc(transaction.id).set({
        ...transaction,
        acknowledgedRisk: input.acknowledgedRisk,
        reasons: input.reasons,
      });

      await db.doc("appState/demo").set(
        {
          currentBalance: nextBalance,
          upcomingBills: baseSnapshot.upcomingBills,
          knownPayees: nextKnownPayees,
          periodLabel: memoryState.dashboard.periodLabel,
          weeklySpending: memoryState.dashboard.weeklySpending,
          totalWeeklySpend: memoryState.dashboard.totalWeeklySpend,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch {
      // Fall back to in-memory state only.
    }
  }

  return {
    transaction,
    currentBalance: nextBalance,
  };
}

export async function getPolicySearchResult(query: string) {
  const guidance = mockPolicyGuidelines
    .map((guideline) => `${guideline.title}: ${guideline.summary}`)
    .join(" ");

  return {
    guidance: `${guidance} Query focus: ${query}.`,
    citations: mockPolicyGuidelines.map((guideline) => guideline.reference),
  };
}

export function getRuntimeDataMode() {
  return getAdminFirestore() ? "firestore" : "memory";
}
