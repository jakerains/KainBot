import type { MaybeRefOrGetter } from "vue";
import { toValue } from "vue";
import { resetAllEveAgents, resetEveAgent } from "~/composables/chat/providers/eve/init";
import { resetStreamLog } from "~/composables/chat/providers/eve/stream-log";

type PendingMessage = {
  chatId: string;
  text: string;
};

let pendingMessage: PendingMessage | null = null;

export async function startChat(message: string, chatId = crypto.randomUUID()) {
  const text = message.trim();
  if (!text) return;

  pendingMessage = { chatId, text };
  await navigateTo(`/chat/${chatId}`);
}

export function consumePendingMessage(chatId: string) {
  if (pendingMessage?.chatId !== chatId) return null;

  const text = pendingMessage.text;
  pendingMessage = null;
  return text;
}

export async function startNewChat() {
  pendingMessage = null;
  resetStreamLog();
  resetAllEveAgents();
  await navigateTo("/");
}

export function useChatNavigation(chatId: MaybeRefOrGetter<string>) {
  function consumePendingOnMount(sendMessage: (text: string) => Promise<void>) {
    const id = toValue(chatId);
    const pending = consumePendingMessage(id);
    if (pending) {
      void sendMessage(pending);
      return true;
    }
    return false;
  }

  function resetCurrentChat() {
    resetEveAgent(toValue(chatId));
  }

  return {
    consumePendingOnMount,
    resetCurrentChat,
  };
}
