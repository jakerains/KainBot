import { requireSessionUserId } from "~~/server/utils/session";
import { getPlaudStatus } from "~~/server/utils/plaud";

export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);
  return await getPlaudStatus(userId);
});
