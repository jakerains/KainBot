import { initEveChat } from "~/composables/chat/providers/eve/init";

export default defineNuxtPlugin(() => {
  initEveChat();
});
