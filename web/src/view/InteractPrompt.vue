<script setup lang="ts">
import { computed } from "vue";
import { t } from "@/web/src/i18n";
import { useSessionStore, useUiStore } from "@/web/src/stores/game";
import { formatActionLabel, formatItemLabel } from "@/web/src/view/labels";
import type { ResolvedAction } from "@/web/src/sim/actions";

const session = useSessionStore();
const ui = useUiStore();

const visible = computed(() => session.alive && Boolean(ui.actionId || ui.promptKind));

const name = computed(() => {
  if (!ui.promptKind) return t("gear.empty");
  return formatItemLabel(ui.promptKind, ui.promptPrep, ui.promptFreshness ?? "fresh");
});

const action = computed((): ResolvedAction | null => {
  if (!ui.actionId) return null;
  return { id: ui.actionId, blocked: ui.actionBlocked };
});
</script>

<template>
  <div id="interact" :hidden="!visible">
    <div id="interact-name">{{ name }}</div>
    <button
      v-if="action"
      type="button"
      id="interact-action"
      :disabled="Boolean(action.blocked)"
      @click="ui.queueInteract()"
    >
      {{ formatActionLabel(action) }}
    </button>
  </div>
</template>
