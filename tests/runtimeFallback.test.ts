import { describe, expect, it } from "vitest";

import { createMockDashboardData } from "../src/data/mockTransactions.js";
import { getDashboardSnapshot } from "../server/lib/store.js";

describe("runtime dashboard fallback", () => {
  it("returns fallback dashboard data when Firestore reads fail", async () => {
    const fallback = createMockDashboardData();
    const failingDb = {
      doc: () => ({
        get: async () => {
          throw new Error("Firestore unavailable");
        },
      }),
      collection: () => ({
        get: async () => {
          throw new Error("Firestore unavailable");
        },
      }),
    };

    const dashboard = await getDashboardSnapshot({ db: failingDb as never });

    expect(dashboard.currentBalance).toBe(fallback.currentBalance);
    expect(dashboard.transactions.length).toBe(fallback.transactions.length);
  });
});
