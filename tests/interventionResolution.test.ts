import { describe, expect, it } from "vitest";

import { getDashboardSnapshot, resetDemoState } from "../server/lib/store.js";
import { cancelTransfer, confirmTransfer } from "../server/nutty.js";

describe("intervention resolution flows", () => {
  it("does not move money when Calm Mode acknowledgement is missing", async () => {
    await resetDemoState({ db: null });
    const before = await getDashboardSnapshot({ db: null });

    const result = await confirmTransfer({
      recipient: "Crypto Exchange",
      amount: 1200,
      acknowledgedRisk: false,
      riskProfile: "balanced",
      riskLogId: "risk-log-1",
      ruleCodes: ["amount_threshold", "high_risk_keyword"],
    });

    const after = await getDashboardSnapshot({ db: null });

    expect(result.status).toBe("error");
    expect(result.reply).toContain("Calm Mode confirmation is required");
    expect(after.currentBalance).toBe(before.currentBalance);
    expect(after.transactions[0]?.id).toBe(before.transactions[0]?.id);
    expect(after.demoState?.hasPersistentData).toBe(false);
  });

  it("persists a reviewed transfer after the user deliberately continues", async () => {
    await resetDemoState({ db: null });

    const result = await confirmTransfer({
      recipient: "Crypto Exchange",
      amount: 1200,
      acknowledgedRisk: true,
      riskProfile: "balanced",
      riskLogId: "risk-log-1",
      ruleCodes: ["amount_threshold", "high_risk_keyword"],
    });

    const dashboard = await getDashboardSnapshot({ db: null });

    expect(result.status).toBe("completed");
    expect(result.reply).toContain("Nutty logged your risk acknowledgement");
    expect(dashboard.currentBalance).toBe(3050);
    expect(dashboard.transactions[0]?.title).toBe("Crypto Exchange");
    expect(dashboard.transactions[0]?.status).toBe("reviewed");
    expect(dashboard.transactions[0]?.colorKey).toBe("warning");
    expect(dashboard.demoState?.hasPersistentData).toBe(true);
  });

  it("keeps the balance unchanged when the user pauses instead of continuing", async () => {
    await resetDemoState({ db: null });
    const before = await getDashboardSnapshot({ db: null });

    const result = await cancelTransfer({
      recipient: "Crypto Exchange",
      amount: 1200,
      riskProfile: "balanced",
      riskLogId: "risk-log-1",
      ruleCodes: ["amount_threshold", "high_risk_keyword"],
    });

    const after = await getDashboardSnapshot({ db: null });

    expect(result.status).toBe("info");
    expect(result.reply).toContain("No money moved");
    expect(after.currentBalance).toBe(before.currentBalance);
    expect(after.transactions[0]?.id).toBe(before.transactions[0]?.id);
    expect(after.demoState?.hasPersistentData).toBe(false);
  });
});
