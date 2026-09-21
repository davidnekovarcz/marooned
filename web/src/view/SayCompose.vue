<script setup lang="ts">
import { nextTick, watch } from "vue";
import { t } from "@/web/src/i18n";
import { useUiStore } from "@/web/src/stores/game";

const ui = useUiStore();

watch(
  () => ui.chatOpen,
  async (open) => {
    if (!open) return;
    await nextTick();
    document.getElementById("say-input")?.focus();
  },
);
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
      :placeholder="t('hud.say')"
    />
  </div>
</template>
