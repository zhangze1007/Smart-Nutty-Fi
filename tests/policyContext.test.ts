import { describe, expect, it } from "vitest";

import { getPolicyContextSnapshot, recordRiskLog, resetDemoState } from "../server/lib/store.js";

describe("policy context snapshot", () => {
  it("returns live policy documents plus the latest logged Calm Mode evidence", async () => {
    await resetDemoState({ db: null });

    await recordRiskLog(
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
        policySummary: "Policy summary from the live Calm Mode flow.",
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

    const snapshot = await getPolicyContextSnapshot({ db: null });

    expect(snapshot.source).toBe("seed");
    expect(snapshot.documents.length).toBeGreaterThan(0);
    expect(snapshot.latestTriggeredReview?.recipient).toBe("Crypto Exchange");
    expect(snapshot.latestTriggeredReview?.ruleHits[0]?.code).toBe("amount_threshold");
    expect(snapshot.latestTriggeredReview?.citations[0]?.url).toMatch(/^https?:\/\//);
  });
});
