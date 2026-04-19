import { describe, expect, it } from "vitest";

import { createBillReviewReply } from "../server/nutty.js";

describe("bill review messaging", () => {
  it("states clearly that the demo does not execute bill payments", () => {
    const reply = createBillReviewReply({
      biller: "Unifi Broadband",
      amount: 159,
    });

    expect(reply).toContain("does not execute bill payments");
    expect(reply).toContain("what-if check");
  });
});
