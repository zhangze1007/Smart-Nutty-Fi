import "dotenv/config";

import { existsSync } from "node:fs";
import path from "node:path";

import express from "express";

import { loadRiskConfig } from "./config/riskConfig.js";
import { assistantFlow, cancelTransfer, confirmTransfer, getBackendStatus } from "./nutty.js";
import { getAccountSnapshot, getDashboardSnapshot, loadPolicyDocuments, resetDemoState } from "./lib/store.js";

const app = express();
const port = Number(process.env.PORT ?? 8080);
const clientDistPath = path.resolve(process.cwd(), "dist/client");
const clientIndexPath = path.join(clientDistPath, "index.html");

app.use(express.json());

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
          response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
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

  app.get("*", (_request, response) => {
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
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
