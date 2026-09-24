// Cloudflare Pages Function: /mcp → the ChartRemotely operator on Horizon.
import { makeMcpProxy } from "@tollbooth-dpyc/web/pages-proxy";

export const onRequest = makeMcpProxy("https://chartremotely-mcp.fastmcp.app/mcp");
