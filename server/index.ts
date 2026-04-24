import "dotenv/config";

import { existsSync } from "node:fs";
import path from "node:path";

import express from "express";

import { loadRiskConfig } from "./config/riskConfig.js";
import { assistantFlow, cancelTransfer, confirmTransfer, getBackendStatus } from "./nutty.js";
import {
  getAccountSnapshot,
  getDashboardSnapshot,
  getPolicyContextSnapshot,
  loadPolicyDocuments,
  resetDemoState,
} from "./lib/store.js";

const app = express();
const port = Number(process.env.PORT ?? 8080);
const clientDistPath = path.resolve(process.cwd(), "dist/client");
const clientIndexPath = path.join(clientDistPath, "index.html");
const validTriggerReasons = [
  "first_time_payee",
  "high_amount",
  "thin_buffer",
  "suspicious_destination",
] as const;

app.use(express.json());

function setNoStore(response: express.Response) {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
}

function sendStaleAssetRecovery(request: express.Request, response: express.Response) {
  setNoStore(response);

  if (request.path.endsWith(".js") || request.path.endsWith(".mjs")) {
    response
      .status(200)
      .type("application/javascript")
      .send(`(function () {
  var recoveryKey = "nutty-fi-stale-asset-recovery";

  function showRecoveryMessage() {
    var markup = '<main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f7f7f2;padding:24px;font-family:Arial,sans-serif;color:#2d2d2a;"><section style="max-width:420px;border:1px solid #e8e8e1;border-radius:20px;background:#fff;padding:24px;"><h1 style="margin:0 0 8px;font-size:24px;">Nutty-Fi needs a refresh</h1><p style="margin:0 0 16px;line-height:1.5;color:#4b5563;">This browser has an old app bundle from before the latest deploy. Reload once to fetch the current app.</p><button type="button" onclick="window.location.reload()" style="height:44px;border:0;border-radius:12px;background:#4a4a32;color:#fff;padding:0 16px;font-weight:700;">Reload Nutty-Fi</button></section></main>';

    if (document.body) {
      document.body.innerHTML = markup;
      return;
    }

    document.addEventListener("DOMContentLoaded", function () {
      document.body.innerHTML = markup;
    });
  }

  try {
    if (window.sessionStorage.getItem(recoveryKey) === "done") {
      showRecoveryMessage();
      return;
    }

    window.sessionStorage.setItem(recoveryKey, "done");
  } catch (error) {
    // Storage is optional; use a best-effort cache-busted reload.
  }

  var separator = window.location.href.indexOf("?") === -1 ? "?" : "&";
  window.location.replace(window.location.href + separator + "nutty_refresh=" + Date.now().toString());
})();`);
    return;
  }

  if (request.path.endsWith(".css")) {
    response.status(200).type("text/css").send("/* stale Nutty-Fi stylesheet ignored */");
    return;
  }

  response.status(404).type("text/plain").send("Frontend asset not found. Refresh the app.");
}

function parseTriggerFlags(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.first_time_payee !== "boolean" ||
    typeof record.high_amount !== "boolean" ||
    typeof record.thin_buffer !== "boolean" ||
    typeof record.suspicious_destination !== "boolean"
  ) {
    return undefined;
  }

  return {
    first_time_payee: record.first_time_payee,
    high_amount: record.high_amount,
    thin_buffer: record.thin_buffer,
    suspicious_destination: record.suspicious_destination,
  };
}

function parseTriggerReasons(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const reasons = value.filter((reason): reason is (typeof validTriggerReasons)[number] =>
    validTriggerReasons.includes(reason as (typeof validTriggerReasons)[number]),
  );

  return reasons.length ? reasons : undefined;
}

app.get("/api/health", async (_request, response) => {
  await Promise.all([loadRiskConfig(), getAccountSnapshot(), loadPolicyDocuments()]);
  response.json({
    status: "ok",
    ...getBackendStatus(),
  });
});

app.get("/api/runtime/dashboard", async (_request, response) => {
  try {
    const dashboard = await getDashboardSnapshot();
    response.json(dashboard);
  } catch (error) {
    response.status(500).json({
      message: error instanceof Error ? error.message : "Nutty could not load the runtime dashboard.",
    });
  }
});

app.get("/api/runtime/policy-context", async (_request, response) => {
  try {
    const policyContext = await getPolicyContextSnapshot();
    response.json(policyContext);
  } catch (error) {
    response.status(500).json({
      message: error instanceof Error ? error.message : "Nutty could not load the policy context.",
    });
  }
});

app.post("/api/demo/reset", async (_request, response) => {
  try {
    const dashboard = await resetDemoState();
    response.json(dashboard);
  } catch (error) {
    response.status(500).json({
      message: error instanceof Error ? error.message : "Nutty could not reset the demo state.",
    });
  }
});

app.post("/api/assistant", async (request, response) => {
  const message = typeof request.body?.message === "string" ? request.body.message.trim() : "";
  const riskProfile =
    typeof request.body?.riskProfile === "string" ? request.body.riskProfile.trim() : undefined;

  if (!message) {
    response.status(400).json({
      reply: "A message is required.",
      intent: "unknown",
      status: "error",
      actionCard: null,
      calmMode: null,
      confirmation: null,
    });
    return;
  }

  try {
    const result = await assistantFlow({
      message,
      riskProfile,
    });

    response.json(result);
  } catch (error) {
    response.status(500).json({
      reply: error instanceof Error ? error.message : "Nutty could not process that request.",
      intent: "unknown",
      status: "error",
      actionCard: null,
      calmMode: null,
      confirmation: null,
    });
  }
});

app.post("/api/actions/confirm-transfer", async (request, response) => {
  const recipient =
    typeof request.body?.recipient === "string" ? request.body.recipient.trim() : "";
  const amount = typeof request.body?.amount === "number" ? request.body.amount : NaN;
  const acknowledgedRisk = request.body?.acknowledgedRisk === true;
  const riskProfile =
    typeof request.body?.riskProfile === "string" ? request.body.riskProfile.trim() : undefined;
  const riskLogId =
    typeof request.body?.riskLogId === "string" ? request.body.riskLogId.trim() : undefined;
  const triggerFlags = parseTriggerFlags(request.body?.triggerFlags);
  const triggerReasons = parseTriggerReasons(request.body?.triggerReasons);
  const ruleCodes = Array.isArray(request.body?.ruleCodes)
    ? request.body.ruleCodes.filter((value: unknown): value is string => typeof value === "string")
    : [];

  if (!recipient || !Number.isFinite(amount)) {
    response.status(400).json({
      reply: "Recipient and amount are required.",
      intent: "unknown",
      status: "error",
      actionCard: null,
      calmMode: null,
      confirmation: null,
    });
    return;
  }

  try {
    const result = await confirmTransfer({
      recipient,
      amount,
      acknowledgedRisk,
      riskProfile,
      riskLogId,
      ruleCodes,
      triggerFlags,
      triggerReasons,
    });

    response.status(result.status === "error" ? 400 : 200).json(result);
  } catch (error) {
    response.status(500).json({
      reply: error instanceof Error ? error.message : "Nutty could not confirm the transfer.",
      intent: "unknown",
      status: "error",
      actionCard: null,
      calmMode: null,
      confirmation: null,
    });
  }
});

app.post("/api/actions/cancel-transfer", async (request, response) => {
  const recipient =
    typeof request.body?.recipient === "string" ? request.body.recipient.trim() : "";
  const amount = typeof request.body?.amount === "number" ? request.body.amount : NaN;
  const riskProfile =
    typeof request.body?.riskProfile === "string" ? request.body.riskProfile.trim() : undefined;
  const riskLogId =
    typeof request.body?.riskLogId === "string" ? request.body.riskLogId.trim() : undefined;
  const triggerFlags = parseTriggerFlags(request.body?.triggerFlags);
  const triggerReasons = parseTriggerReasons(request.body?.triggerReasons);
  const ruleCodes = Array.isArray(request.body?.ruleCodes)
    ? request.body.ruleCodes.filter((value: unknown): value is string => typeof value === "string")
    : [];

  if (!recipient || !Number.isFinite(amount)) {
    response.status(400).json({
      reply: "Recipient and amount are required.",
      intent: "unknown",
      status: "error",
      actionCard: null,
      calmMode: null,
      confirmation: null,
    });
    return;
  }

  try {
    const result = await cancelTransfer({
      recipient,
      amount,
      riskProfile,
      riskLogId,
      ruleCodes,
      triggerFlags,
      triggerReasons,
    });

    response.json(result);
  } catch (error) {
    response.status(500).json({
      reply: error instanceof Error ? error.message : "Nutty could not pause the transfer.",
      intent: "unknown",
      status: "error",
      actionCard: null,
      calmMode: null,
      confirmation: null,
    });
  }
});

if (existsSync(clientDistPath)) {
  app.use(
    express.static(clientDistPath, {
      setHeaders: (response, filePath) => {
        if (filePath.endsWith(".html")) {
          setNoStore(response);
          return;
        }

        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }

        response.setHeader("Cache-Control", "public, max-age=600");
      },
    }),
  );

  app.get("/assets/*", sendStaleAssetRecovery);

  app.get("/favicon.ico", (_request, response) => {
    setNoStore(response);
    response.status(204).send();
  });

  app.get("*", (_request, response) => {
    setNoStore(response);
    response.sendFile(clientIndexPath);
  });
} else {
  app.get("/", (_request, response) => {
    response.json({
      message: "Nutty-Fi API is running. Build the frontend to serve the SPA from this server.",
    });
  });
}

app.listen(port, () => {
  console.log(`Nutty-Fi server listening on port ${port}`);
});
