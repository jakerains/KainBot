import type { EveMessageData } from "eve/vue";
import type { UseEveAgentReturn } from "eve/vue";

const STREAM_LOG_MAX = 50;

export type StreamLogEntry = {
  type: string;
  at: number;
};

let chat: UseEveAgentReturn<EveMessageData> | undefined;
let pendingMessage: string | null = null;

const streamLog = ref<StreamLogEntry[]>([]);
const turnEventCounts = ref<Record<string, number>>({});

function recordStreamEvent(type: string) {
  streamLog.value = [
    { type, at: Date.now() },
    ...streamLog.value,
  ].slice(0, STREAM_LOG_MAX);

  turnEventCounts.value = {
    ...turnEventCounts.value,
    [type]: (turnEventCounts.value[type] ?? 0) + 1,
  };
}

export function resetTurnEventCounts() {
  turnEventCounts.value = {};
}

export function resetStreamLog() {
  streamLog.value = [];
  resetTurnEventCounts();
}

export function useStreamLog() {
  return {
    streamLog: readonly(streamLog),
    turnEventCounts: readonly(turnEventCounts),
    resetStreamLog,
    resetTurnEventCounts,
  };
}

/** Call once from a Nuxt plugin so useEveAgent runs inside a valid setup context. */
export function initEveChat() {
  if (chat) return chat;

  chat = useEveAgent({
    onEvent: (event) => {
      if (!import.meta.dev) return;
      recordStreamEvent(event.type);
    },
  });

  return chat;
}

export function useAdamChat() {
  if (!chat) {
    initEveChat();
  }
  return chat!;
}

/** Navigate to /chat immediately; the stream starts on the chat page (like the Nuxt UI template). */
export async function startChat(message: string) {
  const text = message.trim();
  if (!text) return;

  pendingMessage = text;
  await navigateTo("/chat");
}

export function consumePendingMessage() {
  const text = pendingMessage;
  pendingMessage = null;
  return text;
}

export async function startNewChat() {
  pendingMessage = null;
  resetStreamLog();
  chat?.reset();
  await navigateTo("/");
}
