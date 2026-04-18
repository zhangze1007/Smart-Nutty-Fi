import { randomUUID } from "node:crypto";

import { FieldValue, type Firestore } from "firebase-admin/firestore";

import {
  createMockDashboardData,
  type AppTransaction,
  type DashboardData,
  type SpendingPoint,
} from "../../src/data/mockTransactions.js";
import { policySeedDocuments, type PolicyDocument } from "../data/policySeeds.js";
import type { RiskProfileId } from "../config/riskConfig.js";
import type { RiskRuleCode } from "./risk.js";
import { getAdminFirestore } from "./firebaseAdmin.js";

export type RuntimeDataMode = "firestore" | "memory";
export type PolicyDataSource = "firestore" | "seed";
export type RiskLogEventType = "risk_triggered" | "risk_confirmed" | "risk_cancelled";

export type PolicyCitation = {
  title: string;
  source: string;
  url: string;
};

type AccountSnapshot = Pick<DashboardData, "currentBalance" | "upcomingBills" | "knownPayees">;

type RiskLogEntry = {
  id: string;
  eventType: RiskLogEventType;
  recipient: string;
  amount: number;
  ruleCodes: RiskRuleCode[];
  riskProfile: RiskProfileId;
  createdAt: string;
  relatedRiskLogId?: string;
  message?: string;
};

type SimulationEvent = {
  id: string;
  description: string;
  amount: number;
  remainingBalance: number;
  warning: boolean;
  createdAt: string;
};

type PolicySearchResult = {
  summary: string;
  citations: PolicyCitation[];
  source: PolicyDataSource;
};

const memoryState = {
  dashboard: createMockDashboardData(),
  logs: [] as RiskLogEntry[],
  simulations: [] as SimulationEvent[],
};

let latestRuntimeDataMode: RuntimeDataMode = getAdminFirestore() ? "firestore" : "memory";
let latestPolicyDataSource: PolicyDataSource = "seed";

function createDateLabel(date: Date) {
  return `Today, ${new Intl.DateTimeFormat("en-MY", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)}`;
}

function setRuntimeDataMode(mode: RuntimeDataMode) {
  latestRuntimeDataMode = mode;
}

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

function normalizeAccountSnapshot(
  record: Record<string, unknown>,
  fallback: DashboardData,
): AccountSnapshot {
  return {
    currentBalance:
      typeof record.currentBalance === "number"
        ? record.currentBalance
        : fallback.currentBalance,
    upcomingBills:
      typeof record.upcomingBills === "number" ? record.upcomingBills : fallback.upcomingBills,
    knownPayees:
      Array.isArray(record.knownPayees) &&
      record.knownPayees.every((payee) => typeof payee === "string")
        ? [...record.knownPayees]
        : [...fallback.knownPayees],
  };
}

function sortTransactions(transactions: AppTransaction[]) {
  return [...transactions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function createPolicyCitation(document: PolicyDocument): PolicyCitation {
  return {
    title: document.title,
    source: document.source,
    url: document.sourceUrl,
  };
}

function normalizePolicyDocument(value: unknown): PolicyDocument | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.source !== "string" ||
    typeof record.sourceUrl !== "string" ||
    typeof record.summary !== "string" ||
    typeof record.excerpt !== "string" ||
    !Array.isArray(record.topics) ||
    !Array.isArray(record.keywords)
  ) {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    source: record.source,
    sourceUrl: record.sourceUrl,
    jurisdiction:
      typeof record.jurisdiction === "string" ? record.jurisdiction : "Malaysia",
    summary: record.summary,
    excerpt: record.excerpt,
    topics: record.topics.filter((topic): topic is string => typeof topic === "string"),
    keywords: record.keywords.filter((keyword): keyword is string => typeof keyword === "string"),
  };
}

function tokenizeQuery(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function rankPolicyDocuments(documents: PolicyDocument[], query: string, topics: string[]) {
  const queryTokens = tokenizeQuery(query);

  return [...documents].sort((left, right) => {
    const scoreDocument = (document: PolicyDocument) => {
      const haystack = [
        document.title,
        document.summary,
        document.excerpt,
        ...document.keywords,
        ...document.topics,
      ]
        .join(" ")
        .toLowerCase();

      const tokenScore = queryTokens.reduce(
        (sum, token) => sum + (haystack.includes(token) ? 1 : 0),
        0,
      );
      const topicScore = topics.reduce(
        (sum, topic) => sum + (document.topics.includes(topic) ? 2 : 0),
        0,
      );

      return tokenScore + topicScore;
    };

    return scoreDocument(right) - scoreDocument(left);
  });
}

export async function getAccountSnapshot(options?: { db?: Firestore | null }) {
  const db = options && "db" in options ? options.db ?? null : getAdminFirestore();

  if (!db) {
    setRuntimeDataMode("memory");
    return {
      currentBalance: memoryState.dashboard.currentBalance,
      upcomingBills: memoryState.dashboard.upcomingBills,
      knownPayees: [...memoryState.dashboard.knownPayees],
    };
  }

  try {
    const snapshot = await db.doc("appState/demo").get();

    if (!snapshot.exists) {
      setRuntimeDataMode("memory");
      return {
        currentBalance: memoryState.dashboard.currentBalance,
        upcomingBills: memoryState.dashboard.upcomingBills,
        knownPayees: [...memoryState.dashboard.knownPayees],
      };
    }

    setRuntimeDataMode("firestore");
    return normalizeAccountSnapshot(snapshot.data() ?? {}, memoryState.dashboard);
  } catch {
    setRuntimeDataMode("memory");
    return {
      currentBalance: memoryState.dashboard.currentBalance,
      upcomingBills: memoryState.dashboard.upcomingBills,
      knownPayees: [...memoryState.dashboard.knownPayees],
    };
  }
}

export async function getDashboardSnapshot(options?: { db?: Firestore | null }): Promise<DashboardData> {
  const db = options && "db" in options ? options.db ?? null : getAdminFirestore();
  const fallback = createMockDashboardData();

  if (!db) {
    setRuntimeDataMode("memory");
    return createMockDashboardDataFromMemory();
  }

  try {
    const [stateSnapshot, transactionsSnapshot] = await Promise.all([
      db.doc("appState/demo").get(),
      db.collection("transactions").get(),
    ]);

    if (!stateSnapshot.exists) {
      setRuntimeDataMode("memory");
      return createMockDashboardDataFromMemory();
    }

    const state = stateSnapshot.data() ?? {};
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

    setRuntimeDataMode("firestore");

    return {
      ...normalizeAccountSnapshot(state, fallback),
      periodLabel:
        typeof state.periodLabel === "string" ? state.periodLabel : fallback.periodLabel,
      weeklySpending: weeklySpending.length ? weeklySpending : fallback.weeklySpending,
      totalWeeklySpend: weeklySpending.length
        ? weeklySpending.reduce((sum, point) => sum + point.spend, 0)
        : fallback.totalWeeklySpend,
      transactions: transactions.length ? transactions : fallback.transactions,
    };
  } catch {
    setRuntimeDataMode("memory");
    return createMockDashboardDataFromMemory();
  }
}

function createMockDashboardDataFromMemory(): DashboardData {
  return {
    currentBalance: memoryState.dashboard.currentBalance,
    upcomingBills: memoryState.dashboard.upcomingBills,
    knownPayees: [...memoryState.dashboard.knownPayees],
    periodLabel: memoryState.dashboard.periodLabel,
    weeklySpending: memoryState.dashboard.weeklySpending.map((point) => ({ ...point })),
    totalWeeklySpend: memoryState.dashboard.totalWeeklySpend,
    transactions: memoryState.dashboard.transactions.map((transaction) => ({ ...transaction })),
  };
}

export async function recordRiskLog(
  input: Omit<RiskLogEntry, "id" | "createdAt">,
  options?: { db?: Firestore | null },
) {
  const riskLog: RiskLogEntry = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };

  memoryState.logs.unshift(riskLog);

  const db = options && "db" in options ? options.db ?? null : getAdminFirestore();
  if (db) {
    try {
      await db.collection("logs").doc(riskLog.id).set(riskLog);
      setRuntimeDataMode("firestore");
    } catch {
      setRuntimeDataMode("memory");
    }
  } else {
    setRuntimeDataMode("memory");
  }

  return riskLog;
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
      setRuntimeDataMode("firestore");
    } catch {
      setRuntimeDataMode("memory");
    }
  } else {
    setRuntimeDataMode("memory");
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

      setRuntimeDataMode("firestore");
    } catch {
      setRuntimeDataMode("memory");
    }
  } else {
    setRuntimeDataMode("memory");
  }

  return {
    transaction,
    currentBalance: nextBalance,
  };
}

export async function loadPolicyDocuments(options?: { db?: Firestore | null }) {
  const db = options && "db" in options ? options.db ?? null : getAdminFirestore();

  if (db) {
    try {
      const snapshot = await db.collection("policyDocuments").get();
      const documents = snapshot.docs
        .map((document) => normalizePolicyDocument({ id: document.id, ...document.data() }))
        .filter((document): document is PolicyDocument => document !== null);

      if (documents.length) {
        latestPolicyDataSource = "firestore";
        setRuntimeDataMode("firestore");
        return {
          documents,
          source: "firestore" as const,
        };
      }
    } catch {
      setRuntimeDataMode("memory");
    }
  }

  latestPolicyDataSource = "seed";
  return {
    documents: policySeedDocuments.map((document) => ({ ...document })),
    source: "seed" as const,
  };
}

export async function getPolicySearchResult(input: { query: string; topics?: string[] }): Promise<PolicySearchResult> {
  const { documents, source } = await loadPolicyDocuments();
  const rankedDocuments = rankPolicyDocuments(documents, input.query, input.topics ?? []);
  const matchedDocuments = rankedDocuments.slice(0, 2);

  return {
    summary: matchedDocuments
      .map((document) => `${document.title}: ${document.summary}`)
      .join(" "),
    citations: matchedDocuments.map(createPolicyCitation),
    source,
  };
}

export function getRuntimeDataMode() {
  return latestRuntimeDataMode;
}

export function getPolicyDataSource() {
  return latestPolicyDataSource;
}
