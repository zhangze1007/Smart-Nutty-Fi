import { randomUUID } from "node:crypto";

import { FieldValue, type Firestore } from "firebase-admin/firestore";

import {
  DEMO_SEED_VERSION,
  createMockDashboardData,
  type AppTransaction,
  type DashboardData,
  type DemoStateInfo,
  type SpendingPoint,
  mockDashboardData,
  mockTransactions,
} from "../../src/data/mockTransactions.js";
import { policySeedDocuments, type PolicyDocument } from "../data/policySeeds.js";
import type { RiskProfileId } from "../config/riskConfig.js";
import { isRiskRuleCode, type RiskRuleCode, type RiskRuleHit } from "./risk.js";
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
  ruleHits?: RiskRuleHit[];
  policySummary?: string;
  citations?: PolicyCitation[];
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

export type PolicyContextSnapshot = {
  source: PolicyDataSource;
  documents: Array<{
    id: string;
    title: string;
    source: string;
    sourceUrl: string;
    jurisdiction: string;
    summary: string;
    topics: string[];
  }>;
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

const DEMO_STATE_DOCUMENT_PATH = "appState/demo";

const memoryState = {
  dashboard: createSeedDashboardData(),
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

function createDemoStateExplanation(baselineBalance: number) {
  return `This demo instance includes previous persisted transfers. Reset to return to the clean RM ${baselineBalance.toFixed(2)} judging baseline.`;
}

function createSeedDashboardData(lastResetAt: string | null = null): DashboardData {
  const dashboard = createMockDashboardData();

  return {
    ...dashboard,
    demoState: {
      baselineBalance: dashboard.demoState?.baselineBalance ?? mockDashboardData.currentBalance,
      seedVersion: dashboard.demoState?.seedVersion ?? DEMO_SEED_VERSION,
      hasPersistentData: false,
      explanation: null,
      lastResetAt,
    },
  };
}

function createPersistentDemoState(previousState?: DemoStateInfo): DemoStateInfo {
  const baselineBalance = previousState?.baselineBalance ?? mockDashboardData.currentBalance;

  return {
    baselineBalance,
    seedVersion: previousState?.seedVersion ?? DEMO_SEED_VERSION,
    hasPersistentData: true,
    explanation: createDemoStateExplanation(baselineBalance),
    lastResetAt: previousState?.lastResetAt ?? null,
  };
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

function hasSeedTransactionDrift(transactions: AppTransaction[]) {
  if (!transactions.length) {
    return false;
  }

  if (transactions.length !== mockTransactions.length) {
    return true;
  }

  const seedSignatures = mockTransactions.map(createTransactionSignature).sort();
  const transactionSignatures = transactions.map(createTransactionSignature).sort();

  return transactionSignatures.some((signature, index) => signature !== seedSignatures[index]);
}

function normalizeDemoState(
  record: Record<string, unknown>,
  fallback: DashboardData,
  transactions: AppTransaction[],
): DemoStateInfo {
  const fallbackState = fallback.demoState ?? {
    baselineBalance: fallback.currentBalance,
    seedVersion: DEMO_SEED_VERSION,
    hasPersistentData: false,
    explanation: null,
    lastResetAt: null,
  };

  const baselineBalance =
    typeof record.demoSeedBalance === "number"
      ? record.demoSeedBalance
      : fallbackState.baselineBalance;
  const seedVersion =
    typeof record.demoSeedVersion === "string" ? record.demoSeedVersion : fallbackState.seedVersion;
  const derivedPersistentState =
    typeof record.currentBalance === "number"
      ? record.currentBalance !== baselineBalance ||
        !arraysMatch(
          Array.isArray(record.knownPayees)
            ? record.knownPayees.filter((payee): payee is string => typeof payee === "string")
            : fallback.knownPayees,
          fallback.knownPayees,
        ) ||
        hasSeedTransactionDrift(transactions)
      : hasSeedTransactionDrift(transactions);
  const hasPersistentData =
    typeof record.hasPersistentDemoData === "boolean"
      ? record.hasPersistentDemoData
      : derivedPersistentState;

  return {
    baselineBalance,
    seedVersion,
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

function createDashboardStateDocument(dashboard: DashboardData) {
  const demoState = dashboard.demoState ?? {
    baselineBalance: mockDashboardData.currentBalance,
    seedVersion: DEMO_SEED_VERSION,
    hasPersistentData: false,
    explanation: null,
    lastResetAt: null,
  };

  return {
    currentBalance: dashboard.currentBalance,
    upcomingBills: dashboard.upcomingBills,
    knownPayees: dashboard.knownPayees,
    periodLabel: dashboard.periodLabel,
    weeklySpending: dashboard.weeklySpending,
    totalWeeklySpend: dashboard.totalWeeklySpend,
    demoSeedVersion: demoState.seedVersion,
    demoSeedBalance: demoState.baselineBalance,
    hasPersistentDemoData: demoState.hasPersistentData,
    demoStateMessage: demoState.explanation,
    lastResetAt: demoState.lastResetAt,
    updatedAt: FieldValue.serverTimestamp(),
  };
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

function normalizePolicyCitation(value: unknown): PolicyCitation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.title !== "string" ||
    typeof record.source !== "string" ||
    typeof record.url !== "string"
  ) {
    return null;
  }

  return {
    title: record.title,
    source: record.source,
    url: record.url,
  };
}

function normalizeRiskRuleHit(value: unknown): RiskRuleHit | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.code !== "string" ||
    !isRiskRuleCode(record.code) ||
    typeof record.title !== "string" ||
    typeof record.detail !== "string" ||
    (record.severity !== "medium" && record.severity !== "high") ||
    !Array.isArray(record.policyTopics) ||
    !record.policyTopics.every((topic) => typeof topic === "string")
  ) {
    return null;
  }

  return {
    code: record.code,
    title: record.title,
    detail: record.detail,
    severity: record.severity,
    policyTopics: record.policyTopics,
  };
}

function normalizeRiskLog(id: string, value: unknown): RiskLogEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const eventType =
    record.eventType === "risk_triggered" ||
    record.eventType === "risk_confirmed" ||
    record.eventType === "risk_cancelled"
      ? record.eventType
      : null;
  const riskProfile =
    record.riskProfile === "conservative" ||
    record.riskProfile === "balanced" ||
    record.riskProfile === "flexible"
      ? record.riskProfile
      : null;

  if (
    !eventType ||
    !riskProfile ||
    typeof record.recipient !== "string" ||
    typeof record.amount !== "number" ||
    !Array.isArray(record.ruleCodes) ||
    !record.ruleCodes.every((code) => typeof code === "string") ||
    typeof record.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id,
    eventType,
    recipient: record.recipient,
    amount: record.amount,
    ruleCodes: record.ruleCodes.filter((code): code is RiskRuleCode => isRiskRuleCode(code)),
    riskProfile,
    createdAt: record.createdAt,
    relatedRiskLogId:
      typeof record.relatedRiskLogId === "string" ? record.relatedRiskLogId : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    ruleHits: Array.isArray(record.ruleHits)
      ? record.ruleHits
          .map((ruleHit: unknown) => normalizeRiskRuleHit(ruleHit))
          .filter((ruleHit): ruleHit is RiskRuleHit => ruleHit !== null)
      : undefined,
    policySummary: typeof record.policySummary === "string" ? record.policySummary : undefined,
    citations: Array.isArray(record.citations)
      ? record.citations
          .map((citation: unknown) => normalizePolicyCitation(citation))
          .filter((citation): citation is PolicyCitation => citation !== null)
      : undefined,
  };
}

function findLatestTriggeredReview(logs: RiskLogEntry[]) {
  return [...logs]
    .filter(
      (log) =>
        log.eventType === "risk_triggered" &&
        log.ruleHits?.length &&
        log.policySummary &&
        log.citations?.length,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

function createPolicyContextSnapshot(
  documents: PolicyDocument[],
  source: PolicyDataSource,
  latestTriggeredReview: RiskLogEntry | null,
): PolicyContextSnapshot {
  return {
    source,
    documents: documents.map((document) => ({
      id: document.id,
      title: document.title,
      source: document.source,
      sourceUrl: document.sourceUrl,
      jurisdiction: document.jurisdiction,
      summary: document.summary,
      topics: [...document.topics],
    })),
    latestTriggeredReview: latestTriggeredReview
      ? {
          id: latestTriggeredReview.id,
          recipient: latestTriggeredReview.recipient,
          amount: latestTriggeredReview.amount,
          riskProfile: latestTriggeredReview.riskProfile,
          createdAt: latestTriggeredReview.createdAt,
          ruleHits: latestTriggeredReview.ruleHits ?? [],
          policySummary: latestTriggeredReview.policySummary ?? "",
          citations: latestTriggeredReview.citations ?? [],
        }
      : null,
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
    const snapshot = await db.doc(DEMO_STATE_DOCUMENT_PATH).get();

    if (!snapshot.exists) {
      const seededDashboard = await resetDemoState({ db });
      return {
        currentBalance: seededDashboard.currentBalance,
        upcomingBills: seededDashboard.upcomingBills,
        knownPayees: [...seededDashboard.knownPayees],
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
      db.doc(DEMO_STATE_DOCUMENT_PATH).get(),
      db.collection("transactions").get(),
    ]);

    if (!stateSnapshot.exists) {
      return resetDemoState({ db });
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
      demoState: normalizeDemoState(state, fallback, transactions),
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
    demoState: memoryState.dashboard.demoState
      ? {
          ...memoryState.dashboard.demoState,
        }
      : undefined,
  };
}

export async function resetDemoState(options?: { db?: Firestore | null }): Promise<DashboardData> {
  const db = options && "db" in options ? options.db ?? null : getAdminFirestore();
  const resetAt = new Date().toISOString();
  const nextDashboard = createSeedDashboardData(resetAt);

  memoryState.dashboard = nextDashboard;
  memoryState.logs = [];
  memoryState.simulations = [];

  if (!db) {
    setRuntimeDataMode("memory");
    return createMockDashboardDataFromMemory();
  }

  try {
    const [transactionsSnapshot, logsSnapshot, simulationsSnapshot] = await Promise.all([
      db.collection("transactions").get(),
      db.collection("logs").get(),
      db.collection("simulations").get(),
    ]);

    const batch = db.batch();

    transactionsSnapshot.docs.forEach((document) => {
      batch.delete(document.ref);
    });
    logsSnapshot.docs.forEach((document) => {
      batch.delete(document.ref);
    });
    simulationsSnapshot.docs.forEach((document) => {
      batch.delete(document.ref);
    });

    mockTransactions.forEach((transaction) => {
      batch.set(db.collection("transactions").doc(transaction.id), {
        ...transaction,
        status: transaction.status ?? "completed",
      });
    });

    batch.set(db.doc(DEMO_STATE_DOCUMENT_PATH), createDashboardStateDocument(nextDashboard));

    await batch.commit();
    setRuntimeDataMode("firestore");
  } catch {
    setRuntimeDataMode("memory");
  }

  return createMockDashboardDataFromMemory();
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
}, options?: { db?: Firestore | null }) {
  const db = options && "db" in options ? options.db ?? null : getAdminFirestore();
  const baseSnapshot = await getAccountSnapshot({ db });
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

  memoryState.dashboard = {
    ...memoryState.dashboard,
    currentBalance: nextBalance,
    knownPayees: nextKnownPayees,
    transactions: [transaction, ...memoryState.dashboard.transactions].slice(0, 20),
    demoState: createPersistentDemoState(memoryState.dashboard.demoState),
  };

  if (db) {
    try {
      await db.collection("transactions").doc(transaction.id).set({
        ...transaction,
        acknowledgedRisk: input.acknowledgedRisk,
        reasons: input.reasons,
      });

      await db.doc(DEMO_STATE_DOCUMENT_PATH).set(createDashboardStateDocument(memoryState.dashboard), {
        merge: true,
      });

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
    summary: matchedDocuments.map((document) => document.summary).join(" "),
    citations: matchedDocuments.map(createPolicyCitation),
    source,
  };
}

export async function getPolicyContextSnapshot(options?: {
  db?: Firestore | null;
}): Promise<PolicyContextSnapshot> {
  const db = options && "db" in options ? options.db ?? null : getAdminFirestore();
  const { documents, source } = await loadPolicyDocuments({ db });

  if (!db) {
    return createPolicyContextSnapshot(documents, source, findLatestTriggeredReview(memoryState.logs));
  }

  try {
    const snapshot = await db.collection("logs").get();
    const logs = snapshot.docs
      .map((document) => normalizeRiskLog(document.id, document.data()))
      .filter((log): log is RiskLogEntry => log !== null);

    return createPolicyContextSnapshot(documents, source, findLatestTriggeredReview(logs));
  } catch {
    setRuntimeDataMode("memory");
    return createPolicyContextSnapshot(documents, source, findLatestTriggeredReview(memoryState.logs));
  }
}

export function getRuntimeDataMode() {
  return latestRuntimeDataMode;
}

export function getPolicyDataSource() {
  return latestPolicyDataSource;
}
