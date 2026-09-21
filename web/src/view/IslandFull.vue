<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useUiStore } from "@/web/src/stores/game";

const { t } = useI18n();
const ui = useUiStore();
</script>

<template>
  <p v-if="ui.islandFull" class="island-full">{{ t("hud.islandFull") }}</p>
</template>

<style scoped>
.island-full {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  padding: 0.45rem 0.8rem;
  max-width: min(36rem, 92vw);
  text-align: center;
  color: #f4efe4;
  background: rgba(18, 22, 18, 0.78);
  border-radius: 6px;
  font: 14px/1.35 ui-sans-serif, system-ui, sans-serif;
  z-index: 20;
  pointer-events: none;
}
</style>
