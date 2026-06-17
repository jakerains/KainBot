import type { H3Event } from "h3";
import { timingSafeEqual } from "node:crypto";
import { requireSessionUserId } from "~~/server/utils/session";
import { exchangeCodeForToken, persistPlaudTokens } from "~~/server/utils/plaud";

function backToSettings(event: H3Event, params: string) {
  return sendRedirect(event, `/settings/integrations?${params}`, 302);
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// OAuth callback: validate the CSRF state against the cookie, exchange the code
// (PKCE) for tokens, and persist them for the signed-in user.
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = typeof query.code === "string" ? query.code : null;
  const state = typeof query.state === "string" ? query.state : null;

  const clearCookie = () => deleteCookie(event, "plaud_oauth", { path: "/" });

  if (query.error) {
    clearCookie();
    return backToSettings(event, "plaud_error=access_denied");
  }
  if (!code || !state) {
    clearCookie();
    return backToSettings(event, "plaud_error=missing_params");
  }

  const raw = getCookie(event, "plaud_oauth");
  if (!raw) return backToSettings(event, "plaud_error=invalid_state");

  let stored: { nonce?: string; codeVerifier?: string; userId?: string; ts?: number };
  try {
    stored = JSON.parse(raw);
  } catch {
    clearCookie();
    return backToSettings(event, "plaud_error=invalid_state");
  }

  if (!stored.nonce || !safeEqual(state, stored.nonce)) {
    clearCookie();
    return backToSettings(event, "plaud_error=invalid_state");
  }
  if (!stored.ts || Date.now() - stored.ts > 15 * 60 * 1000) {
    clearCookie();
    return backToSettings(event, "plaud_error=state_expired");
  }

  const userId = await requireSessionUserId(event);
  if (stored.userId !== userId) {
    clearCookie();
    return backToSettings(event, "plaud_error=user_mismatch");
  }

  try {
    const tokens = await exchangeCodeForToken(code, stored.codeVerifier ?? "");
    await persistPlaudTokens(userId, tokens);
    clearCookie();
    return backToSettings(event, "plaud_connected=true");
  } catch (error) {
    console.error("[plaud] callback failed", error);
    clearCookie();
    return backToSettings(event, "plaud_error=callback_failed");
  }
});
