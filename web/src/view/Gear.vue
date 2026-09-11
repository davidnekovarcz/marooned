<script setup lang="ts">
import { computed } from "vue";
import { t } from "@/web/src/i18n";
import { useInventoryStore, useSessionStore, useUiStore } from "@/web/src/stores/game";
import { formatItemLabel } from "@/web/src/view/labels";

const inventory = useInventoryStore();
const session = useSessionStore();
const ui = useUiStore();

const handsLabel = computed(() => {
  if (!inventory.heldKind) return t("gear.empty");
  return formatItemLabel(inventory.heldKind, inventory.heldPrep, inventory.heldFreshness ?? "fresh");
});

function pocketLabel(kind: string | null): string {
  if (!kind) return t("gear.empty");
  return t(`item.${kind}`);
}

// TBD: refactor this
function emptyLabelStyle(label: string | null): string {
  return label == t('gear.empty') ? 'opacity: 0.5' : '';
}
</script>

<template>
  <div id="gear" :hidden="!session.alive">
    <button type="button" class="gear-slot" data-slot="hands" @click="ui.queuePocket('hands')">
      <span class="gear-label">{{ t("gear.hands") }}</span>
      <span class="gear-item" :style="emptyLabelStyle(handsLabel)">
        {{ handsLabel }}
      </span>
    </button>
    <button type="button" class="gear-slot" data-slot="left" @click="ui.queuePocket('left')">
      <span class="gear-label">{{ t("gear.pocketLeft") }}</span>
      <span class="gear-item" :style="emptyLabelStyle(pocketLabel(inventory.left))">
        {{ pocketLabel(inventory.left) }}
      </span>
    </button>
    <button type="button" class="gear-slot" data-slot="right" @click="ui.queuePocket('right')">
      <span class="gear-label">{{ t("gear.pocketRight") }}</span>
      <span class="gear-item" :style="emptyLabelStyle(pocketLabel(inventory.right))">
        {{ pocketLabel(inventory.right) }}
      </span>
    </button>
  </div>
</template>
