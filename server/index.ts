import "dotenv/config";

import { existsSync } from "node:fs";
import path from "node:path";

import express from "express";

import { assistantFlow, confirmTransfer, getBackendStatus } from "./nutty.js";

const app = express();
const port = Number(process.env.PORT ?? 8080);
const clientDistPath = path.resolve(process.cwd(), "dist/client");
const clientIndexPath = path.join(clientDistPath, "index.html");

app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    ...getBackendStatus(),
  });
});

app.post("/api/assistant", async (request, response) => {
  const message = typeof request.body?.message === "string" ? request.body.message.trim() : "";

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

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get("*", (_request, response) => {
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
