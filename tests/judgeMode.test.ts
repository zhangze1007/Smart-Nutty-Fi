import { afterEach, describe, expect, it, vi } from "vitest";

import {
  markJudgeModeInitialized,
  readJudgeModeInitialized,
  shouldAutoResetDemo,
} from "../src/lib/judgeMode.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("persists the first-load marker when sessionStorage is available", () => {
    const storage = new Map<string, string>();

    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    });

    expect(readJudgeModeInitialized()).toBe(false);

    markJudgeModeInitialized();

    expect(readJudgeModeInitialized()).toBe(true);
  });
});
