import { describe, expect, it } from "vitest";

import { getPolicyContextSnapshot, recordRiskLog, resetDemoState } from "../server/lib/store.js";

describe("policy evidence consistency", () => {
  it("keeps the latest complete Calm Mode evidence even when later logs are incomplete or resolved", async () => {
    await resetDemoState({ db: null });

    const triggeredLog = await recordRiskLog(
      {
        eventType: "risk_triggered",
        recipient: "Crypto Exchange",
        amount: 5000,
        ruleCodes: ["amount_threshold", "high_risk_keyword"],
        riskProfile: "balanced",
        message: "Paused for review.",
        ruleHits: [
          {
            code: "amount_threshold",
            title: "Transfer exceeds the review threshold",
            detail: "This transfer is above the review threshold.",
            severity: "medium",
            policyTopics: ["aml_reporting"],
          },
        ],
        policySummary: "Malaysia guidance recommends closer review for higher-risk transfers.",
        citations: [
          {
            title: "Financial Fraud Alert",
            source: "Bank Negara Malaysia",
            url: "https://www.bnm.gov.my/web/financial-fraud-alert",
          },
        ],
      },
      { db: null },
    );

    await recordRiskLog(
      {
        eventType: "risk_confirmed",
        recipient: "Crypto Exchange",
        amount: 5000,
        ruleCodes: ["amount_threshold", "high_risk_keyword"],
        riskProfile: "balanced",
        relatedRiskLogId: triggeredLog.id,
        message: "User reviewed Calm Mode and continued.",
      },
      { db: null },
    );

    await recordRiskLog(
      {
        eventType: "risk_triggered",
        recipient: "Fast Wallet",
        amount: 3000,
        ruleCodes: ["high_risk_keyword"],
        riskProfile: "balanced",
        message: "Paused for review.",
      },
      { db: null },
    );

    const snapshot = await getPolicyContextSnapshot({ db: null });

    expect(snapshot.latestTriggeredReview?.id).toBe(triggeredLog.id);
    expect(snapshot.latestTriggeredReview?.recipient).toBe("Crypto Exchange");
    expect(snapshot.latestTriggeredReview?.policySummary).toContain("Malaysia guidance");
    expect(snapshot.latestTriggeredReview?.citations).toHaveLength(1);
  });
});
