import { defineMcpClientConnection } from "eve/connections";
import { getValidPlaudTokenRemote } from "../lib/plaud-internal.js";

// Plaud's hosted MCP server. Tokens come from Jake's OAuth connection (stored in
// Neon, refreshed on expiry) via the internal API. principalType defaults to
// "app" (one shared credential) — correct here since Kain is a single-user agent.
export default defineMcpClientConnection({
  url: "https://mcp.plaud.ai/mcp",
  description:
    "Plaud voice recorder: list recordings, read AI-generated notes & summaries, fetch timestamped transcripts, and get account info. Use for anything about Jake's recorded meetings, interviews, city-council sessions, or voice memos. If it errors as not connected, tell Jake to connect Plaud in Settings → Integrations.",
  auth: {
    getToken: async () => {
      const { token, expiresAt } = await getValidPlaudTokenRemote();
      return expiresAt ? { token, expiresAt } : { token };
    },
  },
});
