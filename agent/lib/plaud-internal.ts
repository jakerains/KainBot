import { appOrigin, internalHeaders } from "./internal-api.js";

// Resolves a valid Plaud access token from the Nuxt internal API (which holds
// the OAuth tokens in Neon and refreshes them on expiry). Used by the Plaud
// MCP connection's getToken.
export async function getValidPlaudTokenRemote(): Promise<{ token: string; expiresAt: number | null }> {
  const response = await fetch(`${appOrigin()}/api/internal/plaud/token`, {
    headers: internalHeaders(),
  });

  if (!response.ok) {
    throw new Error("Plaud is not connected. Connect it in Settings → Integrations.");
  }

  return response.json() as Promise<{ token: string; expiresAt: number | null }>;
}
