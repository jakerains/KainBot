import { randomBytes } from "node:crypto";
import { requireSessionUserId } from "~~/server/utils/session";
import { generatePkceVerifier, getPlaudAuthUrl } from "~~/server/utils/plaud";

// Starts the Plaud OAuth flow: bind a CSRF nonce + PKCE verifier to this browser
// in an httpOnly cookie, then redirect to Plaud's consent screen.
export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);

  const nonce = randomBytes(32).toString("base64url");
  const codeVerifier = generatePkceVerifier();

  setCookie(event, "plaud_oauth", JSON.stringify({ nonce, codeVerifier, userId, ts: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60,
  });

  return sendRedirect(event, getPlaudAuthUrl(nonce, codeVerifier), 302);
});
