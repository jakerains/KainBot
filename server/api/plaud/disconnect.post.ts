import { requireSessionUserId } from "~~/server/utils/session";
import { deletePlaudConnection } from "~~/server/utils/plaud";

export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);
  await deletePlaudConnection(userId);
  return { ok: true };
});
