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
        :aria-label="t('mobile.zoomIn')"
        @pointerdown.prevent="zoomStart(-1)"
        @pointerup="zoomEnd"
        @pointercancel="zoomEnd"
        @pointerleave="zoomEnd"
      >
        <svg class="mobile-zoom-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M15.2 15.2 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <path d="M10.5 7.75v5.5M7.75 10.5h5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        class="mobile-tool mobile-zoom-btn"
        :aria-label="t('mobile.zoomOut')"
        @pointerdown.prevent="zoomStart(1)"
        @pointerup="zoomEnd"
        @pointercancel="zoomEnd"
        @pointerleave="zoomEnd"
      >
        <svg class="mobile-zoom-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M15.2 15.2 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <path d="M7.75 10.5h5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </div>
</template>
