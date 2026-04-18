import { describe, expect, it } from "vitest";

import { createMockDashboardData } from "../src/data/mockTransactions.js";
import { getDashboardSnapshot, resetDemoState, saveTransfer } from "../server/lib/store.js";

describe("demo state reset", () => {
  it("restores the seeded demo baseline after persistent transfers", async () => {
    const fallback = createMockDashboardData();

    await resetDemoState({ db: null });
    await saveTransfer({
      recipient: "Fresh Scam Payee",
      amount: 120,
      reasons: ["Unfamiliar payee"],
      acknowledgedRisk: true,
    }, { db: null });

    const dirtyDashboard = await getDashboardSnapshot({ db: null });
    expect(dirtyDashboard.demoState?.hasPersistentData).toBe(true);

    const resetDashboard = await resetDemoState({ db: null });

    expect(resetDashboard.currentBalance).toBe(fallback.currentBalance);
    expect(resetDashboard.transactions).toHaveLength(fallback.transactions.length);
    expect(resetDashboard.transactions[0]?.id).toBe(fallback.transactions[0]?.id);
    expect(resetDashboard.demoState?.hasPersistentData).toBe(false);
    expect(resetDashboard.demoState?.lastResetAt).toBeTruthy();
  });

  it("derives a reset explanation for previously persisted Firestore demo data", async () => {
    const fakeDb = {
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => ({
            currentBalance: -850,
            upcomingBills: 850,
            knownPayees: ["Ali bin Abu", "Unifi Broadband", "Crypto Exchange"],
            periodLabel: "Apr 11 - 17",
            weeklySpending: [],
            totalWeeklySpend: 0,
          }),
        }),
      }),
      collection: () => ({
        get: async () => ({
          docs: [
            {
              id: "tx-demo-1",
              data: () => ({
                title: "Crypto Exchange",
                category: "Transfer",
                amount: -5100,
                date: "Today, 10:20 AM",
                createdAt: "2026-04-18T10:20:00.000Z",
                iconKey: "transfer",
                colorKey: "warning",
              }),
            },
          ],
        }),
      }),
    };

    const dashboard = await getDashboardSnapshot({ db: fakeDb as never });

    expect(dashboard.demoState?.hasPersistentData).toBe(true);
    expect(dashboard.demoState?.explanation).toContain("Reset");
    expect(dashboard.demoState?.baselineBalance).toBe(4250);
  });
});
