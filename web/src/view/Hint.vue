<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { t } from "@/web/src/i18n";
import { watchMobileUi } from "@/web/src/input/mobileUi";
import { useUiStore } from "@/web/src/stores/game";

const ui = useUiStore();
const mobileUi = ref(false);
let stopWatch: (() => void) | null = null;

const text = computed(() => {
  if (!ui.audioUnlocked) return t("hud.hintLocked");
  return mobileUi.value ? t("hud.hintTouch") : t("hud.hint");
});

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
  <div id="hint">{{ text }}</div>
</template>
