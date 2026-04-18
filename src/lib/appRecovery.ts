const RECOVERABLE_STORAGE_KEYS = ["nutty-risk-profile", "nutty-text-scale"] as const;

let handlersInstalled = false;
let fatalFallbackRendered = false;

function describeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown browser startup error";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function clearRecoverableClientState() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    RECOVERABLE_STORAGE_KEYS.forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch {
    // Some browsers block storage access entirely.
  }
}

export function renderFatalAppFallback(input?: {
  title?: string;
  message?: string;
  error?: unknown;
}) {
  if (typeof document === "undefined" || fatalFallbackRendered) {
    return;
  }

  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  fatalFallbackRendered = true;

  const title = input?.title ?? "Nutty-Fi needs a quick refresh";
  const message =
    input?.message ??
    "This browser ran into a loading problem. Your demo data is safe, and you can recover without leaving the page.";
  const details = escapeHtml(describeError(input?.error));

  root.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f7f7f2;padding:24px;font-family:'Helvetica Neue',Arial,sans-serif;color:#2d2d2a;">
      <section style="width:min(100%,420px);border:1px solid #e8e8e1;border-radius:28px;background:#ffffff;padding:28px;box-shadow:0 16px 40px rgba(45,45,42,0.08);">
        <div style="display:flex;height:56px;width:56px;align-items:center;justify-content:center;border-radius:999px;background:#4a4a32;color:#ffffff;font-size:24px;font-weight:700;">N</div>
        <h1 style="margin:20px 0 8px;font-size:28px;line-height:1.15;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4b5563;">${escapeHtml(message)}</p>
        <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#6b6b61;">If this happened right after a deploy, a refresh usually picks up the latest app shell and fixes the mismatch.</p>
        <div style="display:grid;gap:12px;">
          <button type="button" data-action="reload" style="height:48px;border:0;border-radius:16px;background:#4a4a32;color:#ffffff;font-size:15px;font-weight:700;cursor:pointer;">Reload Nutty-Fi</button>
          <button type="button" data-action="reset" style="height:48px;border:1px solid #d1d5db;border-radius:16px;background:#ffffff;color:#2d2d2a;font-size:15px;font-weight:700;cursor:pointer;">Clear local settings and reload</button>
        </div>
        <details style="margin-top:18px;border-top:1px solid #e8e8e1;padding-top:14px;">
          <summary style="cursor:pointer;font-size:13px;font-weight:700;color:#4a4a32;">Technical details</summary>
          <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:#6b6b61;word-break:break-word;">${details}</p>
        </details>
      </section>
    </main>
  `;

  root.querySelector<HTMLButtonElement>('[data-action="reload"]')?.addEventListener("click", () => {
    window.location.reload();
  });

  root.querySelector<HTMLButtonElement>('[data-action="reset"]')?.addEventListener("click", () => {
    clearRecoverableClientState();
    window.location.reload();
  });
}

export function installGlobalAppRecoveryHandlers() {
  if (handlersInstalled || typeof window === "undefined") {
    return;
  }

  handlersInstalled = true;

  window.addEventListener("error", (event) => {
    renderFatalAppFallback({
      message:
        "Nutty-Fi hit an unexpected browser error while loading. Reloading normally fixes stale deploy or compatibility issues.",
      error: event.error ?? event.message,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    renderFatalAppFallback({
      message:
        "Nutty-Fi could not finish loading one of its startup requests. Try a clean reload to fetch the latest app files.",
      error: event.reason,
    });
  });
}
