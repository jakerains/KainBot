import type { MaybeRefOrGetter } from "vue";
import { computed, toValue } from "vue";
import type { AgentInputResponse } from "~/components/AgentInputRequest.vue";
import type { ChatSession } from "~/composables/chat/types";
import { toUIMessages } from "./adapter";
import { getOrCreateEveAgent } from "./init";

export function createEveChatSession(chatId: MaybeRefOrGetter<string>): ChatSession {
  const id = computed(() => toValue(chatId));
  const agent = computed(() => getOrCreateEveAgent(id.value));

  const messages = computed(() => toUIMessages(agent.value.data.value.messages));

  const status = computed(() => agent.value.status.value);
  const error = computed(() => agent.value.error.value);

  const isBusy = computed(
    () => status.value === "submitted" || status.value === "streaming",
  );

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    await agent.value.send({ message: trimmed });
  }

  async function sendInputResponses(responses: AgentInputResponse[]) {
    await agent.value.send({ inputResponses: responses });
  }

  function stop() {
    agent.value.stop();
  }

  function reset() {
    agent.value.reset();
  }

  return {
    messages,
    status,
    error,
    isBusy,
    sendMessage,
    sendInputResponses,
    stop,
    reset,
  };
}
