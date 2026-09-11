<script setup lang="ts">
import { computed } from "vue";
import { t } from "@/web/src/i18n";
import { useUiStore } from "@/web/src/stores/game";
import { formatDeathTime } from "@/web/src/view/labels";

const ui = useUiStore();
const message = computed(() => formatDeathTime(ui.deathHours));

function respawn(): void {
  window.location.reload();
}
</script>

<template>
  <div id="death" :hidden="!ui.dead">
    <p id="death-message">{{ message }}<br />{{ t("hud.death") }}</p>
    <button type="button" id="death-respawn" @click="respawn">{{ t("hud.respawn") }}</button>
  </div>
</template>
