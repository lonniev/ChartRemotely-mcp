import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { agentGuide } from "@tollbooth-dpyc/web/agent-guide"

// Files under public/ keep a fixed URL and the domain tells browsers to cache
// them for hours, so the Setup Shortcut's link carries a hash of its bytes: a
// re-signed Shortcut is a new URL the moment it deploys.
const setupShortcutVersion = createHash("sha256")
  .update(readFileSync("public/ChartRemotely-Setup.shortcut"))
  .digest("hex")
  .slice(0, 10);

// The front end's own version, shown under Build & license on Profile.
const appVersion = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;

export default defineConfig({
  plugins: [
    react(), tailwindcss(),
    agentGuide({
      name: "ChartRemotely",
      summary: "Put a security on a desktop chart anywhere in the world, by voice or by tool call.",
      site: "https://chartremotely.tollbooth-dpyc.com",
      mcpUrl: "https://chartremotely-mcp.fastmcp.app/mcp",
      toolPrefix: "chart",
      source: "https://github.com/lonniev/ChartRemotely-mcp",
      registryName: "io.github.lonniev/chartremotely-mcp",
      body: "agent-guide.md",
      links: [{ label: "The Mac agent", url: "https://github.com/lonniev/ChartRemotely-agent" }],
    }),
  ],
  define: {
    __SETUP_SHORTCUT_VERSION__: JSON.stringify(setupShortcutVersion),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: { outDir: "dist" },
});
