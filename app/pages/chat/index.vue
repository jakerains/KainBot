<script setup lang="ts">
import type { UIMessage } from "ai";
import type { EveMessage } from "eve/vue";
import type { AgentInputResponse } from "~/components/AgentInputRequest.vue";

const { data, error, send, status, stop } = useAdamChat();
const { resetTurnEventCounts } = useStreamLog();

const messages = computed(() => [...data.value.messages] as EveMessage[]);
const isBusy = computed(
  () => status.value === "submitted" || status.value === "streaming",
);

const input = ref("");

watch(status, (value) => {
  if (value === "submitted") {
    resetTurnEventCounts();
  }
});

onMounted(() => {
  const pending = consumePendingMessage();
  if (pending) {
    void send({ message: pending });
    return;
  }

  if (messages.value.length === 0) {
    void navigateTo("/");
  }
});

function handleSubmit(e: Event) {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || isBusy.value) return;
  input.value = "";
  void send({ message: text });
}

function handleInputResponses(inputResponses: AgentInputResponse[]) {
  void send({ inputResponses });
}
</script>

<template>
  <UDashboardPanel
    id="chat"
    class="relative min-h-0"
    :ui="{ body: 'p-0 sm:p-0 overscroll-none' }"
  >
    <template #header>
      <Navbar>
        <template #title>
          <p class="truncate text-sm font-medium text-highlighted">
            Chat
          </p>
        </template>
      </Navbar>
    </template>

    <template #body>
      <div class="flex flex-1">
        <UContainer class="flex flex-1 flex-col gap-4 sm:gap-6">
          <UChatMessages
            should-auto-scroll
            :messages="messages as unknown as UIMessage[]"
            :status="status"
            :spacing-offset="160"
            :assistant="{ side: 'left', variant: 'naked', ui: { container: 'relative flex w-full min-w-0 items-start' } }"
            class="pt-(--ui-header-height) pb-4 sm:pb-6"
          >
            <template #indicator>
              <ChatActivityIndicator />
            </template>

            <template #content="{ message }">
              <ChatMessageContent
                :message="message as EveMessage"
                :status="status"
                :is-last="message.id === messages.at(-1)?.id"
                :can-respond="!isBusy"
                @input-responses="handleInputResponses"
              />
            </template>
          </UChatMessages>

          <UChatPrompt
            v-model="input"
            :error="error"
            variant="subtle"
            class="sticky bottom-0 z-10 [view-transition-name:chat-prompt] rounded-b-none"
            :ui="{ base: 'px-1.5' }"
            @submit="handleSubmit"
          >
            <template #footer>
              <ChatStreamInspector :status="status" />

              <UChatPromptSubmit
                :status="status"
                color="neutral"
                size="sm"
                @stop="stop()"
              />
            </template>
          </UChatPrompt>
        </UContainer>
      </div>
    </template>
  </UDashboardPanel>
</template>
