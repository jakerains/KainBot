<script setup lang="ts">
interface PlaudStatus {
  connected: boolean;
  accountEmail?: string;
}

const { data: status, pending, refresh } = useFetch<PlaudStatus>("/api/plaud/status", {
  server: false,
  default: () => ({ connected: false }),
});

const toast = useToast();
const route = useRoute();
const router = useRouter();
const disconnecting = ref(false);

const isConnected = computed(() => status.value?.connected === true);

onMounted(() => {
  if (route.query.plaud_connected) {
    toast.add({
      title: "Plaud connected",
      description: "Kain can now read your recordings, notes, and transcripts.",
      color: "success",
      icon: "i-lucide-check",
    });
    refresh();
    router.replace({ query: {} });
  }
  else if (route.query.plaud_error) {
    toast.add({
      title: "Couldn't connect Plaud",
      description: `Error: ${String(route.query.plaud_error)}. Try again.`,
      color: "error",
      icon: "i-lucide-alert-triangle",
    });
    router.replace({ query: {} });
  }
});

async function disconnect() {
  disconnecting.value = true;
  try {
    await $fetch("/api/plaud/disconnect", { method: "POST" });
    await refresh();
    toast.add({ title: "Plaud disconnected", color: "neutral", icon: "i-lucide-unlink" });
  }
  finally {
    disconnecting.value = false;
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 px-4 py-3">
      <div
        class="flex size-8 shrink-0 items-center justify-center rounded-md border border-default bg-elevated"
      >
        <UIcon
          name="i-lucide-mic"
          class="size-4 text-toned"
        />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3 class="text-sm text-highlighted">
            Plaud
          </h3>
          <span
            v-if="!pending"
            class="inline-flex items-center gap-1.5 text-[11px] text-muted"
          >
            <span
              class="size-1.5 shrink-0 rounded-full"
              :class="isConnected ? 'bg-emerald-400/90' : 'bg-toned'"
            />
            {{ isConnected ? "Connected" : "Not connected" }}
          </span>
        </div>
        <p class="truncate text-xs text-muted">
          <template v-if="isConnected && status?.accountEmail">
            {{ status.accountEmail }}
          </template>
          <template v-else>
            Let Kain read your recordings, AI notes, and transcripts.
          </template>
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-1.5">
        <UButton
          v-if="isConnected"
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-unlink"
          :loading="disconnecting"
          aria-label="Disconnect Plaud"
          @click="disconnect"
        />
        <UButton
          v-else
          color="neutral"
          variant="soft"
          size="xs"
          to="/api/plaud/connect"
          external
        >
          Connect
        </UButton>
      </div>
    </div>
  </div>
</template>
