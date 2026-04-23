import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import {
  createMockDashboardData,
  type AppTransaction,
  type DashboardData,
  type DemoStateInfo,
  type SpendingPoint,
} from "@/data/mockTransactions";
import { getFirebaseDb } from "@/lib/firebase";
import type { PolicyContextData, RiskPrompt } from "@/lib/types";

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

const DASHBOARD_CACHE_STORAGE_KEY = "nutty-dashboard-cache-v1";
const POLICY_CONTEXT_CACHE_STORAGE_KEY = "nutty-policy-context-cache-v1";

function readStorageValue(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Best effort cache only; runtime state remains the source of truth.
  }
}

function normalizeCachedDemoState(value: unknown, fallback: DashboardData): DemoStateInfo | undefined {
  if (!value || typeof value !== "object") {
    return fallback.demoState;
  }

  const record = value as Record<string, unknown>;
  const explanation = record.explanation;
  const lastResetAt = record.lastResetAt;
  if (
    typeof record.baselineBalance !== "number" ||
    typeof record.seedVersion !== "string" ||
    typeof record.hasPersistentData !== "boolean" ||
    (explanation !== null && typeof explanation !== "string") ||
    (lastResetAt !== null && typeof lastResetAt !== "string")
  ) {
    return fallback.demoState;
  }

  return {
    baselineBalance: record.baselineBalance,
    seedVersion: record.seedVersion,
    hasPersistentData: record.hasPersistentData,
    explanation: typeof explanation === "string" ? explanation : null,
    lastResetAt: typeof lastResetAt === "string" ? lastResetAt : null,
  };
}

function normalizeCachedDashboard(value: unknown): DashboardData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const fallback = createFallbackDashboard();
  const record = value as Record<string, unknown>;
  if (
    typeof record.currentBalance !== "number" ||
    typeof record.upcomingBills !== "number" ||
    typeof record.periodLabel !== "string" ||
    typeof record.totalWeeklySpend !== "number" ||
    !Array.isArray(record.knownPayees) ||
    !record.knownPayees.every((payee) => typeof payee === "string") ||
    !Array.isArray(record.weeklySpending) ||
    !Array.isArray(record.transactions)
  ) {
    return null;
  }

  const weeklySpending = record.weeklySpending
    .map((point) => normalizeSpendingPoint(point))
    .filter((point): point is SpendingPoint => point !== null);
  const transactions = record.transactions
    .map((transaction) => {
      if (!transaction || typeof transaction !== "object") {
        return null;
      }

      const transactionRecord = transaction as Record<string, unknown>;
      return typeof transactionRecord.id === "string"
        ? normalizeTransaction(transactionRecord.id, transactionRecord)
        : null;
    })
    .filter((transaction): transaction is AppTransaction => transaction !== null);

  if (!weeklySpending.length || !transactions.length) {
    return null;
  }

  return {
    currentBalance: record.currentBalance,
    upcomingBills: record.upcomingBills,
    knownPayees: [...record.knownPayees],
    periodLabel: record.periodLabel,
    weeklySpending,
    totalWeeklySpend: record.totalWeeklySpend,
    transactions,
    demoState: normalizeCachedDemoState(record.demoState, fallback),
  };
}

function readCachedDashboardFromStorage() {
  const storedValue = readStorageValue(DASHBOARD_CACHE_STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    return normalizeCachedDashboard(JSON.parse(storedValue));
  } catch {
    return null;
  }
}

type DashboardListener = (dashboard: DashboardData) => void;

let dashboardCache = readCachedDashboardFromStorage() ?? createFallbackDashboard();
let dashboardLocalMutationVersion = 0;
let dashboardRefreshRequest: null | {
  promise: Promise<DashboardData>;
} = null;

const dashboardListeners = new Set<DashboardListener>();

function cloneDashboardData(dashboard: DashboardData): DashboardData {
  return {
    currentBalance: dashboard.currentBalance,
    upcomingBills: dashboard.upcomingBills,
    knownPayees: [...dashboard.knownPayees],
    periodLabel: dashboard.periodLabel,
    weeklySpending: dashboard.weeklySpending.map((point) => ({ ...point })),
    totalWeeklySpend: dashboard.totalWeeklySpend,
    transactions: dashboard.transactions.map((transaction) => ({ ...transaction })),
    demoState: dashboard.demoState ? { ...dashboard.demoState } : undefined,
  };
}

function publishDashboardData(nextDashboard: DashboardData) {
  dashboardCache = cloneDashboardData(nextDashboard);
  writeStorageValue(DASHBOARD_CACHE_STORAGE_KEY, JSON.stringify(dashboardCache));

  const publishedDashboard = getCachedDashboardData();

  dashboardListeners.forEach((listener) => {
    listener(cloneDashboardData(publishedDashboard));
  });
}

function publishLocalDashboardData(nextDashboard: DashboardData) {
  dashboardLocalMutationVersion += 1;
  publishDashboardData(nextDashboard);
}

export function getCachedDashboardData() {
  return cloneDashboardData(dashboardCache);
}

export function subscribeDashboardData(listener: DashboardListener) {
  dashboardListeners.add(listener);

  return () => {
    dashboardListeners.delete(listener);
  };
}

export function applyConfirmedTransferToDashboard(input: {
  currentBalance: number;
  transaction: AppTransaction;
}) {
  const fallback = createFallbackDashboard();
  const previousDemoState = dashboardCache.demoState ?? fallback.demoState;
  const baselineBalance = previousDemoState?.baselineBalance ?? fallback.currentBalance;
  const existingTransactions = dashboardCache.transactions.filter(
    (transaction) => transaction.id !== input.transaction.id,
  );
  const knownPayees = input.transaction.recipient
    ? Array.from(new Set([...dashboardCache.knownPayees, input.transaction.recipient]))
    : dashboardCache.knownPayees;

  publishLocalDashboardData({
    ...dashboardCache,
    currentBalance: input.currentBalance,
    knownPayees,
    transactions: [{ ...input.transaction }, ...existingTransactions].slice(0, 20),
    demoState: {
      baselineBalance,
      seedVersion: previousDemoState?.seedVersion ?? fallback.demoState?.seedVersion ?? "hackathon-baseline-v1",
      hasPersistentData: true,
      explanation: previousDemoState?.explanation ?? createDemoStateExplanation(baselineBalance),
      lastResetAt: previousDemoState?.lastResetAt ?? null,
    },
  });
}

type PolicyContextListener = (policyContext: PolicyContextData | null) => void;

function clonePolicyContextData(policyContext: PolicyContextData): PolicyContextData {
  return {
    source: policyContext.source,
    documents: policyContext.documents.map((document) => ({
      ...document,
      topics: [...document.topics],
    })),
    latestTriggeredReview: policyContext.latestTriggeredReview
      ? {
          ...policyContext.latestTriggeredReview,
          ruleHits: policyContext.latestTriggeredReview.ruleHits.map((ruleHit) => ({
            ...ruleHit,
            policyTopics: [...ruleHit.policyTopics],
          })),
          citations: policyContext.latestTriggeredReview.citations.map((citation) => ({
            ...citation,
          })),
          triggerReasons: [...policyContext.latestTriggeredReview.triggerReasons],
          triggerFlags: { ...policyContext.latestTriggeredReview.triggerFlags },
          recipientAssurance: policyContext.latestTriggeredReview.recipientAssurance
            ? { ...policyContext.latestTriggeredReview.recipientAssurance }
            : undefined,
        }
      : null,
    interventionMetrics: {
      ...policyContext.interventionMetrics,
      topTriggerReasons: policyContext.interventionMetrics.topTriggerReasons.map((reason) => ({
        ...reason,
      })),
    },
  };
}

function normalizeCachedPolicyContext(value: unknown): PolicyContextData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as PolicyContextData;
  if (
    (record.source !== "firestore" && record.source !== "seed") ||
    !Array.isArray(record.documents) ||
    !record.interventionMetrics
  ) {
    return null;
  }

  return clonePolicyContextData(record);
}

function readCachedPolicyContextFromStorage() {
  const storedValue = readStorageValue(POLICY_CONTEXT_CACHE_STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    return normalizeCachedPolicyContext(JSON.parse(storedValue));
  } catch {
    return null;
  }
}

function createEmptyPolicyContextData(): PolicyContextData {
  return {
    source: "seed",
    documents: [],
    latestTriggeredReview: null,
    interventionMetrics: {
      interventionCount: 0,
      pauseCount: 0,
      continueCount: 0,
      pauseRate: 0,
      continueRate: 0,
      topTriggerReasons: [],
    },
  };
}

let policyContextCache = readCachedPolicyContextFromStorage();
let policyContextLocalMutationVersion = 0;
let policyContextRefreshRequest: null | {
  promise: Promise<PolicyContextData>;
} = null;

const policyContextListeners = new Set<PolicyContextListener>();

function publishPolicyContextData(nextPolicyContext: PolicyContextData) {
  policyContextCache = clonePolicyContextData(nextPolicyContext);
  writeStorageValue(POLICY_CONTEXT_CACHE_STORAGE_KEY, JSON.stringify(policyContextCache));

  const publishedPolicyContext = getCachedPolicyContextData();

  policyContextListeners.forEach((listener) => {
    listener(publishedPolicyContext ? clonePolicyContextData(publishedPolicyContext) : null);
  });
}

function publishLocalPolicyContextData(nextPolicyContext: PolicyContextData) {
  policyContextLocalMutationVersion += 1;
  publishPolicyContextData(nextPolicyContext);
}

function recalculateInterventionRates(metrics: PolicyContextData["interventionMetrics"]) {
  const interventionCount = metrics.interventionCount || 0;

  return {
    ...metrics,
    pauseRate: interventionCount ? metrics.pauseCount / interventionCount : 0,
    continueRate: interventionCount ? metrics.continueCount / interventionCount : 0,
  };
}

function incrementTopTriggerReasons(
  topTriggerReasons: PolicyContextData["interventionMetrics"]["topTriggerReasons"],
  triggerReasons: RiskPrompt["triggerReasons"],
) {
  const counts = new Map(topTriggerReasons.map((reason) => [reason.reason, reason.count]));

  triggerReasons.forEach((reason) => {
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count);
}

export function getCachedPolicyContextData() {
  return policyContextCache ? clonePolicyContextData(policyContextCache) : null;
}

export function subscribePolicyContextData(listener: PolicyContextListener) {
  policyContextListeners.add(listener);

  return () => {
    policyContextListeners.delete(listener);
  };
}

export function applyTriggeredReviewToPolicyContext(riskPrompt: RiskPrompt) {
  const previousPolicyContext = policyContextCache ?? createEmptyPolicyContextData();
  const reviewId = riskPrompt.riskLogId ?? `${riskPrompt.recipient}-${riskPrompt.amount}`;
  const isSameReview = previousPolicyContext.latestTriggeredReview?.id === reviewId;
  const previousMetrics = previousPolicyContext.interventionMetrics;

  const nextMetrics = isSameReview
    ? previousMetrics
    : recalculateInterventionRates({
        ...previousMetrics,
        interventionCount: previousMetrics.interventionCount + 1,
        topTriggerReasons: incrementTopTriggerReasons(
          previousMetrics.topTriggerReasons,
          riskPrompt.triggerReasons,
        ),
      });

  publishLocalPolicyContextData({
    ...previousPolicyContext,
    latestTriggeredReview: {
      id: reviewId,
      recipient: riskPrompt.recipient,
      amount: riskPrompt.amount,
      riskProfile: riskPrompt.appliedProfile,
      createdAt: new Date().toISOString(),
      ruleHits: riskPrompt.ruleHits,
      policySummary: riskPrompt.policySummary,
      citations: riskPrompt.citations,
      triggerReasons: riskPrompt.triggerReasons,
      triggerFlags: riskPrompt.triggerFlags,
      recipientAssurance: riskPrompt.recipientAssurance,
    },
    interventionMetrics: nextMetrics,
  });
}

async function fetchRuntimeDashboard() {
  const response = await fetch("/api/runtime/dashboard");

  if (!response.ok) {
    throw new Error("Runtime dashboard request failed.");
  }

  return (await response.json()) as DashboardData;
}

async function fetchRuntimePolicyContext() {
  const response = await fetch("/api/runtime/policy-context");

  if (!response.ok) {
    throw new Error("Runtime policy context request failed.");
  }

  return (await response.json()) as PolicyContextData;
}

export async function resetDemoData() {
  const response = await fetch("/api/demo/reset", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Demo reset request failed.");
  }

  const resetDashboard = (await response.json()) as DashboardData;
  publishLocalDashboardData(resetDashboard);

  return getCachedDashboardData();
}

async function loadDashboardData(): Promise<DashboardData> {
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

export function revalidateDashboardData(options?: { force?: boolean }): Promise<DashboardData> {
  if (dashboardRefreshRequest && !options?.force) {
    return dashboardRefreshRequest.promise;
  }

  const refreshMutationVersion = dashboardLocalMutationVersion;
  const refreshRequest = {
    promise: loadDashboardData()
      .then((nextDashboard) => {
        if (refreshMutationVersion === dashboardLocalMutationVersion) {
          publishDashboardData(nextDashboard);
        }

        return getCachedDashboardData();
      })
      .finally(() => {
        if (dashboardRefreshRequest === refreshRequest) {
          dashboardRefreshRequest = null;
        }
      }),
  };

  dashboardRefreshRequest = refreshRequest;

  return refreshRequest.promise;
}

export async function getDashboardData(): Promise<DashboardData> {
  return revalidateDashboardData();
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

export function revalidatePolicyContextData(options?: { force?: boolean }): Promise<PolicyContextData> {
  if (policyContextRefreshRequest && !options?.force) {
    return policyContextRefreshRequest.promise;
  }

  const refreshMutationVersion = policyContextLocalMutationVersion;
  const refreshRequest = {
    promise: fetchRuntimePolicyContext()
      .then((nextPolicyContext) => {
        if (refreshMutationVersion === policyContextLocalMutationVersion) {
          publishPolicyContextData(nextPolicyContext);
        }

        return getCachedPolicyContextData() ?? nextPolicyContext;
      })
      .finally(() => {
        if (policyContextRefreshRequest === refreshRequest) {
          policyContextRefreshRequest = null;
        }
      }),
  };

  policyContextRefreshRequest = refreshRequest;

  return refreshRequest.promise;
}

export async function getPolicyContextData() {
  return revalidatePolicyContextData();
}
