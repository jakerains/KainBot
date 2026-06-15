import type { ComputedRef, Ref } from "vue";
import type { UIMessage } from "ai";
import type { AgentInputResponse } from "~/components/AgentInputRequest.vue";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export interface ChatSession {
  messages: ComputedRef<UIMessage[]>;
  status: Ref<ChatStatus> | ComputedRef<ChatStatus>;
  error: Ref<Error | undefined> | ComputedRef<Error | undefined>;
  isBusy: ComputedRef<boolean>;
  sendMessage: (text: string) => Promise<void>;
  sendInputResponses: (responses: AgentInputResponse[]) => Promise<void>;
  stop: () => void;
  reset: () => void;
}
