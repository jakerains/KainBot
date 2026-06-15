import type { MaybeRefOrGetter } from "vue";
import type { ChatSession } from "~/composables/chat/types";
import { createEveChatSession } from "~/composables/chat/providers/eve/session";

export function useChatSession(chatId: MaybeRefOrGetter<string> = "default"): ChatSession {
  return createEveChatSession(chatId);
}
