import { createHash, randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "../db/client";

// Plaud's hosted MCP server speaks OAuth 2.0 (Authorization Code + PKCE, public
// client — no secret). Endpoints discovered from @plaud-ai/mcp; flow ported from
// the lemonnotes implementation. Only PLAUD_CLIENT_ID is required.
export const PLAUD_AUTH_URL = "https://mcp.plaud.ai/authorize";
export const PLAUD_TOKEN_URL = "https://mcp.plaud.ai/token";
export const PLAUD_MCP_URL = "https://mcp.plaud.ai/mcp";

const TOKEN_EXPIRY_SKEW_MS = 60_000;

function clientId(): string {
  const id = process.env.PLAUD_CLIENT_ID?.trim();
  if (!id) {
    throw createError({ statusCode: 503, statusMessage: "Plaud is not configured (PLAUD_CLIENT_ID)" });
  }
  return id;
}

// Must exactly match a redirect_uri registered for the OAuth client.
export function plaudRedirectUri(): string {
  const origin = process.env.BETTER_AUTH_URL?.trim().replace(/\/$/, "")
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${origin}/api/plaud/callback`;
}

// ---- PKCE (S256) ----
export function generatePkceVerifier(): string {
  return randomBytes(96).toString("base64url").slice(0, 128);
}

function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function getPlaudAuthUrl(state: string, verifier: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId(),
    redirect_uri: plaudRedirectUri(),
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge(verifier),
  });
  return `${PLAUD_AUTH_URL}?${params.toString()}`;
}

// ---- Token exchange / refresh ----
interface PlaudTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export async function exchangeCodeForToken(code: string, verifier: string): Promise<PlaudTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: clientId(),
    redirect_uri: plaudRedirectUri(),
  });
  const res = await fetch(PLAUD_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Plaud token exchange failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  return await res.json() as PlaudTokenResponse;
}

export async function refreshPlaudToken(refreshToken: string): Promise<PlaudTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId(),
  });
  const res = await fetch(PLAUD_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Plaud token refresh failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  return await res.json() as PlaudTokenResponse;
}

function expiresAtFrom(expiresIn?: number): Date | null {
  if (!expiresIn || Number.isNaN(expiresIn)) return null;
  return new Date(Date.now() + expiresIn * 1000);
}

// ---- Persistence (Neon) ----
export async function persistPlaudTokens(
  userId: string,
  tokens: PlaudTokenResponse,
  opts: { accountId?: string | null; accountEmail?: string | null } = {},
): Promise<void> {
  const expiresAt = expiresAtFrom(tokens.expires_in);
  await db
    .insert(schema.plaudConnections)
    .values({
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiresAt: expiresAt,
      accountId: opts.accountId ?? null,
      accountEmail: opts.accountEmail ?? null,
    })
    .onConflictDoUpdate({
      target: schema.plaudConnections.userId,
      set: {
        accessToken: tokens.access_token,
        tokenExpiresAt: expiresAt,
        // Refresh tokens may rotate; keep the existing one if the response omits a new one.
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        ...(opts.accountId ? { accountId: opts.accountId } : {}),
        ...(opts.accountEmail ? { accountEmail: opts.accountEmail } : {}),
      },
    });
}

export async function readPlaudConnection(userId: string) {
  const [row] = await db
    .select()
    .from(schema.plaudConnections)
    .where(eq(schema.plaudConnections.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function deletePlaudConnection(userId: string): Promise<void> {
  await db.delete(schema.plaudConnections).where(eq(schema.plaudConnections.userId, userId));
}

export async function getPlaudStatus(userId: string) {
  const row = await readPlaudConnection(userId);
  return row
    ? { connected: true as const, accountEmail: row.accountEmail ?? undefined, connectedAt: row.connectedAt }
    : { connected: false as const };
}

interface ValidToken {
  token: string;
  expiresAt: number | null;
}

/** Return a valid access token for a user, refreshing + persisting if near expiry. */
export async function getValidPlaudToken(userId: string): Promise<ValidToken> {
  const row = await readPlaudConnection(userId);
  if (!row?.accessToken) {
    throw createError({ statusCode: 404, statusMessage: "Plaud not connected" });
  }

  const expMs = row.tokenExpiresAt ? new Date(row.tokenExpiresAt).getTime() : 0;
  const needsRefresh = expMs > 0 && expMs - Date.now() < TOKEN_EXPIRY_SKEW_MS;

  if (needsRefresh && row.refreshToken) {
    const refreshed = await refreshPlaudToken(row.refreshToken);
    await persistPlaudTokens(userId, refreshed);
    const newExp = expiresAtFrom(refreshed.expires_in);
    return { token: refreshed.access_token, expiresAt: newExp ? newExp.getTime() : null };
  }

  return { token: row.accessToken, expiresAt: expMs || null };
}

/**
 * App-scoped token resolution for the Eve connection (which has no per-user
 * principal). Kain is a single-user agent, so the one connected Plaud account
 * is the right one. Returns null if nobody has connected Plaud.
 */
export async function getAppPlaudToken(): Promise<ValidToken | null> {
  const [row] = await db
    .select({ userId: schema.plaudConnections.userId })
    .from(schema.plaudConnections)
    .orderBy(desc(schema.plaudConnections.connectedAt))
    .limit(1);
  if (!row) return null;
  return getValidPlaudToken(row.userId);
}
