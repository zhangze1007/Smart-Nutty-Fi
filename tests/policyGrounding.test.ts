import { describe, expect, it } from "vitest";

import { formatCitationLabel } from "../server/nutty.js";
import { policySeedDocuments } from "../server/data/policySeeds.js";

describe("Malaysia policy grounding", () => {
  it("formats citation labels with title and source for clearer Calm Mode references", () => {
    expect(
      formatCitationLabel({
        title: "Bank Negara Malaysia Financial Fraud Alert",
        source: "Bank Negara Malaysia fraud alert material",
        url: "https://www.bnm.gov.my/web/financial-fraud-alert",
      }),
    ).toBe(
      "Bank Negara Malaysia Financial Fraud Alert from Bank Negara Malaysia fraud alert material",
    );
  });

  it("keeps seeded policy documents Malaysia-specific and reviewable", () => {
    expect(policySeedDocuments.every((document) => document.jurisdiction === "Malaysia")).toBe(true);
    expect(policySeedDocuments.some((document) => document.title.includes("Bank Negara Malaysia"))).toBe(true);
    expect(policySeedDocuments.some((document) => document.title.includes("Act 613"))).toBe(true);
  });
});
