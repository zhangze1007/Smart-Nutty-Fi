import { describe, expect, it } from "vitest";

import { parseIntentDeterministically } from "../server/nutty.js";

describe("deterministic intent parsing", () => {
  it("classifies scam-like money movement phrasing as a transfer", () => {
    const result = parseIntentDeterministically(
      "My friend says I need to urgently move RM3000 to his wallet to unlock prize money",
    );

    expect(result.intent).toBe("transfer_money");
    expect(result.amount).toBe(3000);
    expect(result.recipient).toBe("His Wallet");
  });

  it("keeps wallet-style send phrasing on the transfer path", () => {
    const result = parseIntentDeterministically("Send RM200 to new wallet address now");

    expect(result.intent).toBe("transfer_money");
    expect(result.amount).toBe(200);
    expect(result.recipient).toBe("New Wallet Address");
  });

  it("classifies affordability questions as cashflow checks instead of bill pay", () => {
    const result = parseIntentDeterministically("Can I afford RM480 after bills?");

    expect(result.intent).toBe("calculate_cashflow");
    expect(result.amount).toBe(480);
    expect(result.biller).toBeNull();
  });

  it("keeps explicit bill requests as bill pay intents", () => {
    const result = parseIntentDeterministically("Pay my Unifi bill");

    expect(result.intent).toBe("pay_bill");
    expect(result.amount).toBe(159);
    expect(result.biller).toBe("Unifi Broadband");
  });
});
