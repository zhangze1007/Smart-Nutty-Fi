import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import "./index.css";
import { installGlobalAppRecoveryHandlers, renderFatalAppFallback } from "./lib/appRecovery";

installGlobalAppRecoveryHandlers();

try {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("Missing root element.");
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  renderFatalAppFallback({
    title: "Nutty-Fi could not start",
    message:
      "This browser could not complete the app bootstrap. Reloading should fetch a clean startup bundle.",
    error,
  });
}
