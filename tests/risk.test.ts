import { describe, expect, it } from "vitest";

import { loadRiskConfig, resolveRiskConfig } from "../server/config/riskConfig.js";
import { assessTransferRisk } from "../server/lib/risk.js";

describe("risk configuration", () => {
  it("applies env overrides for the selected risk profile", async () => {
    const config = await loadRiskConfig({
      db: null,
      env: {
        RISK_DEFAULT_PROFILE: "conservative",
        RISK_PROFILE_CONSERVATIVE_MAX_TRANSFER_WITHOUT_CONFIRM: "450",
        RISK_PROFILE_CONSERVATIVE_MIN_BALANCE_THRESHOLD: "900",
        RISK_HIGH_RISK_KEYWORDS: "crypto, exchange, wallet",
      },
    });

    const resolvedConfig = resolveRiskConfig(config);

    expect(config.source).toBe("env");
    expect(resolvedConfig.requestedProfile).toBe("conservative");
    expect(resolvedConfig.maxTransferWithoutConfirm).toBe(450);
    expect(resolvedConfig.minBalanceThreshold).toBe(900);
    expect(resolvedConfig.highRiskKeywords).toContain("wallet");
  });
});

describe("assessTransferRisk", () => {
  it("returns structured rule hits and citations-ready topics", async () => {
    const config = resolveRiskConfig(await loadRiskConfig({ db: null }), "balanced");
    const assessment = assessTransferRisk(
      {
        recipient: "Crypto Exchange",
        amount: 1500,
        currentBalance: 1800,
        upcomingBills: 600,
        knownPayees: ["Ali bin Abu"],
      },
      config,
    );

    expect(assessment.risky).toBe(true);
    expect(assessment.ruleHits.map((ruleHit) => ruleHit.code)).toEqual([
      "amount_threshold",
      "high_risk_keyword",
      "unknown_payee",
      "low_remaining_balance",
    ]);
    expect(assessment.ruleHits[0]?.policyTopics.length).toBeGreaterThan(0);
    expect(assessment.reasons).toHaveLength(4);
    expect(assessment.triggerFlags).toEqual({
      first_time_payee: true,
      high_amount: true,
      thin_buffer: true,
      suspicious_destination: true,
    });
    expect(assessment.triggerReasons).toEqual(
      expect.arrayContaining([
        "first_time_payee",
        "high_amount",
        "thin_buffer",
        "suspicious_destination",
      ]),
    );
    expect(assessment.recipientAssurance.status).toBe("not_previously_verified");
    expect(assessment.recipientAssurance.detail).not.toContain("definitely fraudulent");
  });

  it("makes first-time payee review stricter for conservative than flexible", async () => {
    const baseConfig = await loadRiskConfig({ db: null });
    const conservativeAssessment = assessTransferRisk(
      {
        recipient: "New Seller",
        amount: 150,
        currentBalance: 2500,
        upcomingBills: 400,
        knownPayees: ["Ali bin Abu"],
      },
      resolveRiskConfig(baseConfig, "conservative"),
    );
    const flexibleAssessment = assessTransferRisk(
      {
        recipient: "New Seller",
        amount: 150,
        currentBalance: 2500,
        upcomingBills: 400,
        knownPayees: ["Ali bin Abu"],
      },
      resolveRiskConfig(baseConfig, "flexible"),
    );

    expect(conservativeAssessment.ruleHits.map((ruleHit) => ruleHit.code)).toContain("unknown_payee");
    expect(flexibleAssessment.ruleHits.map((ruleHit) => ruleHit.code)).not.toContain("unknown_payee");
  });
});
