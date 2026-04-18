import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import {
  createMockDashboardData,
  type AppTransaction,
  type DashboardData,
  type DemoStateInfo,
  type SpendingPoint,
} from "@/data/mockTransactions";
import { getFirebaseDb } from "@/lib/firebase";

function normalizeSpendingPoint(value: unknown): SpendingPoint | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string" || typeof record.spend !== "number") {
    return null;
  }

  return {
    name: record.name,
    spend: record.spend,
  };
}

function normalizeTransaction(id: string, value: unknown): AppTransaction | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.title !== "string" ||
    typeof record.category !== "string" ||
    typeof record.amount !== "number" ||
    typeof record.date !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.iconKey !== "string" ||
    typeof record.colorKey !== "string"
  ) {
    return null;
  }

  return {
    id,
    title: record.title,
    category: record.category,
    amount: record.amount,
    date: record.date,
    createdAt: record.createdAt,
    iconKey: record.iconKey as AppTransaction["iconKey"],
    colorKey: record.colorKey as AppTransaction["colorKey"],
    isIncome: Boolean(record.isIncome),
    recipient: typeof record.recipient === "string" ? record.recipient : undefined,
    status: record.status === "reviewed" ? "reviewed" : "completed",
  };
}

function sortTransactions(transactions: AppTransaction[]) {
  return [...transactions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function createDemoStateExplanation(baselineBalance: number) {
  return `This demo instance includes previous persisted transfers. Reset to return to the clean RM ${baselineBalance.toFixed(2)} judging baseline.`;
}

function arraysMatch(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function createTransactionSignature(transaction: Pick<AppTransaction, "id" | "title" | "amount" | "createdAt">) {
  return [transaction.id, transaction.title, transaction.amount.toString(), transaction.createdAt].join("|");
}

function hasSeedTransactionDrift(transactions: AppTransaction[], fallback: DashboardData) {
  if (!transactions.length) {
    return false;
  }

  if (transactions.length !== fallback.transactions.length) {
    return true;
  }

  const fallbackSignatures = fallback.transactions.map(createTransactionSignature).sort();
  const transactionSignatures = transactions.map(createTransactionSignature).sort();

  return transactionSignatures.some((signature, index) => signature !== fallbackSignatures[index]);
}

function normalizeDemoState(
  record: Record<string, unknown>,
  fallback: DashboardData,
  transactions: AppTransaction[],
): DemoStateInfo {
  const fallbackState = fallback.demoState ?? {
    baselineBalance: fallback.currentBalance,
    seedVersion: "hackathon-baseline-v1",
    hasPersistentData: false,
    explanation: null,
    lastResetAt: null,
  };

  const baselineBalance =
    typeof record.demoSeedBalance === "number"
      ? record.demoSeedBalance
      : fallbackState.baselineBalance;
  const derivedPersistentState =
    typeof record.currentBalance === "number"
      ? record.currentBalance !== baselineBalance ||
        !arraysMatch(
          Array.isArray(record.knownPayees)
            ? record.knownPayees.filter((payee): payee is string => typeof payee === "string")
            : fallback.knownPayees,
          fallback.knownPayees,
        ) ||
        hasSeedTransactionDrift(transactions, fallback)
      : hasSeedTransactionDrift(transactions, fallback);
  const hasPersistentData =
    typeof record.hasPersistentDemoData === "boolean"
      ? record.hasPersistentDemoData
      : derivedPersistentState;

  return {
    baselineBalance,
    seedVersion:
      typeof record.demoSeedVersion === "string" ? record.demoSeedVersion : fallbackState.seedVersion,
    hasPersistentData,
    explanation:
      hasPersistentData
        ? typeof record.demoStateMessage === "string" && record.demoStateMessage.trim().length
          ? record.demoStateMessage
          : createDemoStateExplanation(baselineBalance)
        : null,
    lastResetAt: typeof record.lastResetAt === "string" ? record.lastResetAt : fallbackState.lastResetAt,
  };
}

function createFallbackDashboard() {
  return createMockDashboardData();
}

async function fetchRuntimeDashboard() {
  const response = await fetch("/api/runtime/dashboard");

  if (!response.ok) {
    throw new Error("Runtime dashboard request failed.");
  }

  return (await response.json()) as DashboardData;
}

export async function resetDemoData() {
  const response = await fetch("/api/demo/reset", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Demo reset request failed.");
  }

  return (await response.json()) as DashboardData;
}

export async function getDashboardData(): Promise<DashboardData> {
  const fallback = createFallbackDashboard();
  const db = getFirebaseDb();

  if (db) {
    try {
      const [stateSnapshot, transactionsSnapshot] = await Promise.all([
        getDoc(doc(db, "appState", "demo")),
        getDocs(collection(db, "transactions")),
      ]);

      if (stateSnapshot.exists()) {
        const state = stateSnapshot.data();
        const transactions = sortTransactions(
          transactionsSnapshot.docs
            .map((transactionDoc) => normalizeTransaction(transactionDoc.id, transactionDoc.data()))
            .filter((transaction): transaction is AppTransaction => transaction !== null),
        );

        const weeklySpending = Array.isArray(state.weeklySpending)
          ? state.weeklySpending
              .map((point: unknown) => normalizeSpendingPoint(point))
              .filter((point): point is SpendingPoint => point !== null)
          : fallback.weeklySpending;

        return {
          currentBalance:
            typeof state.currentBalance === "number" ? state.currentBalance : fallback.currentBalance,
          upcomingBills:
            typeof state.upcomingBills === "number" ? state.upcomingBills : fallback.upcomingBills,
          knownPayees:
            Array.isArray(state.knownPayees) &&
            state.knownPayees.every((payee) => typeof payee === "string")
              ? [...state.knownPayees]
              : fallback.knownPayees,
          periodLabel:
            typeof state.periodLabel === "string" ? state.periodLabel : fallback.periodLabel,
          weeklySpending: weeklySpending.length ? weeklySpending : fallback.weeklySpending,
          totalWeeklySpend: weeklySpending.length
            ? weeklySpending.reduce((sum, point) => sum + point.spend, 0)
            : fallback.totalWeeklySpend,
          transactions: transactions.length ? transactions : fallback.transactions,
          demoState: normalizeDemoState(state as Record<string, unknown>, fallback, transactions),
        };
      }
    } catch {
      // If Firestore reads fail, try the server runtime snapshot before falling back to mock data.
    }
  }

  try {
    return await fetchRuntimeDashboard();
  } catch {
    return fallback;
  }
}

export async function getTransactionsData() {
  const dashboard = await getDashboardData();

  return {
    transactions: dashboard.transactions,
    weeklySpending: dashboard.weeklySpending,
    totalWeeklySpend: dashboard.totalWeeklySpend,
    periodLabel: dashboard.periodLabel,
  };
}
