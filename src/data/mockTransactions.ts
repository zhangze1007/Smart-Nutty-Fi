export type TransactionIconKey = "coffee" | "bill" | "income" | "shopping" | "transfer";
export type TransactionColorKey = "warning" | "primary" | "safe" | "secondary";

export type AppTransaction = {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  createdAt: string;
  iconKey: TransactionIconKey;
  colorKey: TransactionColorKey;
  isIncome?: boolean;
  recipient?: string;
  status?: "completed" | "reviewed";
};

export type SpendingPoint = {
  name: string;
  spend: number;
};

export type DemoStateInfo = {
  baselineBalance: number;
  seedVersion: string;
  hasPersistentData: boolean;
  explanation: string | null;
  lastResetAt: string | null;
};

export type DashboardData = {
  currentBalance: number;
  upcomingBills: number;
  knownPayees: string[];
  periodLabel: string;
  weeklySpending: SpendingPoint[];
  totalWeeklySpend: number;
  transactions: AppTransaction[];
  demoState?: DemoStateInfo;
};

export const mockWeeklySpending: SpendingPoint[] = [
  { name: "Mon", spend: 45 },
  { name: "Tue", spend: 120 },
  { name: "Wed", spend: 35 },
  { name: "Thu", spend: 80 },
  { name: "Fri", spend: 210 },
  { name: "Sat", spend: 150 },
  { name: "Sun", spend: 90 },
];

export const mockTransactions: AppTransaction[] = [
  {
    id: "tx-1",
    title: "Starbucks",
    category: "Food & Dining",
    amount: -18.5,
    date: "Today, 9:41 AM",
    createdAt: "2026-04-17T09:41:00.000Z",
    iconKey: "coffee",
    colorKey: "warning",
  },
  {
    id: "tx-2",
    title: "Unifi Broadband",
    category: "Bills",
    amount: -159,
    date: "Yesterday",
    createdAt: "2026-04-16T11:00:00.000Z",
    iconKey: "bill",
    colorKey: "primary",
  },
  {
    id: "tx-3",
    title: "Salary",
    category: "Income",
    amount: 4500,
    date: "Apr 1",
    createdAt: "2026-04-01T09:00:00.000Z",
    iconKey: "income",
    colorKey: "safe",
    isIncome: true,
  },
  {
    id: "tx-4",
    title: "Shopee",
    category: "Shopping",
    amount: -124.3,
    date: "Apr 12",
    createdAt: "2026-04-12T08:20:00.000Z",
    iconKey: "shopping",
    colorKey: "secondary",
  },
];

const totalWeeklySpend = mockWeeklySpending.reduce((sum, item) => sum + item.spend, 0);
export const DEMO_SEED_VERSION = "hackathon-baseline-v1";

export const mockDashboardData: DashboardData = {
  currentBalance: 4250,
  upcomingBills: 850,
  knownPayees: ["Ali bin Abu", "Unifi Broadband", "TNB Utilities", "Maxis Mobile"],
  periodLabel: "Apr 11 - 17",
  weeklySpending: mockWeeklySpending,
  totalWeeklySpend,
  transactions: mockTransactions,
  demoState: {
    baselineBalance: 4250,
    seedVersion: DEMO_SEED_VERSION,
    hasPersistentData: false,
    explanation: null,
    lastResetAt: null,
  },
};

export function createMockDashboardData(): DashboardData {
  return {
    currentBalance: mockDashboardData.currentBalance,
    upcomingBills: mockDashboardData.upcomingBills,
    knownPayees: [...mockDashboardData.knownPayees],
    periodLabel: mockDashboardData.periodLabel,
    weeklySpending: mockDashboardData.weeklySpending.map((point) => ({ ...point })),
    totalWeeklySpend: mockDashboardData.totalWeeklySpend,
    transactions: mockDashboardData.transactions.map((transaction) => ({ ...transaction })),
    demoState: mockDashboardData.demoState
      ? {
          ...mockDashboardData.demoState,
        }
      : undefined,
  };
}
