<script setup lang="ts">
import { computed } from "vue";
import { t } from "@/web/src/i18n";
import { useUiStore } from "@/web/src/stores/game";

const ui = useUiStore();
const text = computed(() => (ui.audioUnlocked ? t("hud.hint") : t("hud.hintLocked")));
</script>

<template>
  <div id="hint">{{ text }}</div>
</template>
