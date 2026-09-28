<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { t } from "@/web/src/i18n";
import { watchMobileUi } from "@/web/src/input/mobileUi";
import { useUiStore } from "@/web/src/stores/game";

const ui = useUiStore();
const mobileUi = ref(false);
let stopWatch: (() => void) | null = null;

const showActions = computed(() => mobileUi.value && ui.chatOpen);

watch(
  () => ui.chatOpen,
  async (open) => {
    if (!open) return;
    await nextTick();
    document.getElementById("say-input")?.focus();
  },
);

function send(): void {
  ui.queueSendChat();
}

function cancel(): void {
  ui.queueCancelChat();
}

onMounted(() => {
  stopWatch = watchMobileUi((on) => {
    mobileUi.value = on;
  });
});

onUnmounted(() => {
  stopWatch?.();
  stopWatch = null;
});
</script>

<template>
  <div id="say-compose" :hidden="!ui.chatOpen">
    <input
      id="say-input"
      v-model="ui.chatDraft"
      type="text"
      maxlength="72"
      autocomplete="off"
      spellcheck="false"
      enterkeyhint="send"
      :placeholder="t('hud.say')"
    />
    <div v-if="showActions" class="say-actions">
      <button type="button" class="say-action say-cancel" @click="cancel">
        {{ t("hud.sayCancel") }}
      </button>
      <button type="button" class="say-action say-send" @click="send">
        {{ t("hud.saySend") }}
      </button>
    </div>
  </div>
</template>
