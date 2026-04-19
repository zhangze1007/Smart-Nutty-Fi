import { describe, expect, it } from "vitest";

import { shouldAutoResetDemo } from "../src/lib/judgeMode.js";

describe("judge mode auto reset", () => {
  it("auto-resets only when stale persisted demo data is present on first load", () => {
    expect(
      shouldAutoResetDemo(
        {
          baselineBalance: 4250,
          seedVersion: "hackathon-baseline-v1",
          hasPersistentData: true,
          explanation: "Reset required.",
          lastResetAt: "2026-04-18T13:17:05.904Z",
        },
        false,
      ),
    ).toBe(true);

    expect(
      shouldAutoResetDemo(
        {
          baselineBalance: 4250,
          seedVersion: "hackathon-baseline-v1",
          hasPersistentData: false,
          explanation: null,
          lastResetAt: null,
        },
        false,
      ),
    ).toBe(false);

    expect(
      shouldAutoResetDemo(
        {
          baselineBalance: 4250,
          seedVersion: "hackathon-baseline-v1",
          hasPersistentData: true,
          explanation: "Reset required.",
          lastResetAt: "2026-04-18T13:17:05.904Z",
        },
        true,
      ),
    ).toBe(false);
  });
});
