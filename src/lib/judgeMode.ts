import type { DemoStateInfo } from "@/data/mockTransactions";

const JUDGE_MODE_SESSION_KEY = "nutty-judge-mode-initialized";

function safeReadSessionStorage(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteSessionStorage(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Some embedded browsers block sessionStorage access.
  }
}

export function readJudgeModeInitialized() {
  return safeReadSessionStorage(JUDGE_MODE_SESSION_KEY) === "true";
}

export function markJudgeModeInitialized() {
  safeWriteSessionStorage(JUDGE_MODE_SESSION_KEY, "true");
}

export function shouldAutoResetDemo(
  demoState: DemoStateInfo | null | undefined,
  judgeModeInitialized: boolean,
) {
  return Boolean(demoState?.hasPersistentData && !judgeModeInitialized);
}
