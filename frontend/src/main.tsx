import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { configureTollbooth } from "@tollbooth-dpyc/web";
import App from "./App";
import "./index.css";

configureTollbooth({
  slug: "chart",
  appName: "ChartRemotely",
  mcpUrl: import.meta.env.VITE_MCP_URL || "/mcp",
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
