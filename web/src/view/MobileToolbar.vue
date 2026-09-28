<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { t } from "@/web/src/i18n";
import { mobileInput } from "@/web/src/input/mobileBind";
import { watchMobileUi } from "@/web/src/input/mobileUi";
import { useSessionStore, useUiStore } from "@/web/src/stores/game";

const session = useSessionStore();
const ui = useUiStore();
const mobileUi = ref(false);
let stopWatch: (() => void) | null = null;

const visible = computed(
  () => mobileUi.value && session.alive && !ui.dead && !ui.islandFull && !ui.chatOpen,
);

function say(): void {
  ui.queueOpenChat();
}

function zoomStart(dir: number): void {
  mobileInput()?.setZoomDir(dir);
}

function zoomEnd(): void {
  mobileInput()?.setZoomDir(0);
}

onMounted(() => {
  stopWatch = watchMobileUi((on) => {
    mobileUi.value = on;
  });
});

onUnmounted(() => {
  stopWatch?.();
  stopWatch = null;
  mobileInput()?.setZoomDir(0);
});
</script>

<template>
  <div id="mobile-toolbar" :hidden="!visible">
    <button type="button" class="mobile-tool" @click="say">{{ t("mobile.say") }}</button>
    <div class="mobile-zoom">
      <button
        type="button"
        class="mobile-tool mobile-zoom-btn"
        :aria-label="t('mobile.zoomOut')"
        @pointerdown.prevent="zoomStart(1)"
        @pointerup="zoomEnd"
        @pointercancel="zoomEnd"
        @pointerleave="zoomEnd"
      >
        −
      </button>
      <button
        type="button"
        class="mobile-tool mobile-zoom-btn"
        :aria-label="t('mobile.zoomIn')"
        @pointerdown.prevent="zoomStart(-1)"
        @pointerup="zoomEnd"
        @pointercancel="zoomEnd"
        @pointerleave="zoomEnd"
      >
        +
      </button>
    </div>
  </div>
</template>
