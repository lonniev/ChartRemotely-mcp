import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { configureTollbooth, startLanguage } from "@tollbooth-dpyc/web";
import App from "./App";
import { registerChartRemotely } from "./i18n";
import "./index.css";

configureTollbooth({
  slug: "chart",
  appName: "ChartRemotely",
  mcpUrl: import.meta.env.VITE_MCP_URL || "/mcp",
  operatorUrl: "https://chartremotely-mcp.fastmcp.app",
});

// ChartRemotely's words, then the reader's language: their choice, else their
// country's, else English. ChartRemotely draws its own shell, so it starts this
// itself (the package's AppShell would otherwise).
void registerChartRemotely();
void startLanguage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
