import { requireInternalRequest } from "~~/server/utils/internal-api";
import { getAppPlaudToken } from "~~/server/utils/plaud";

// Agent-only: returns a valid Plaud access token (app-scoped — single-user agent),
// refreshing it on expiry. Consumed by agent/connections/plaud.ts getToken.
export default defineEventHandler(async (event) => {
  requireInternalRequest(event);
  const result = await getAppPlaudToken();
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Plaud not connected" });
  }
  return result;
});
