<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { t } from "@/web/src/i18n";
import { watchMobileUi } from "@/web/src/input/mobileUi";
import { useInventoryStore, useSessionStore, useUiStore } from "@/web/src/stores/game";
import { formatItemLabel } from "@/web/src/view/labels";

const inventory = useInventoryStore();
const session = useSessionStore();
const ui = useUiStore();
const mobileUi = ref(false);
let stopWatch: (() => void) | null = null;

const handsLabel = computed(() => {
  if (!inventory.heldKind) return t("gear.empty");
  return formatItemLabel(inventory.heldKind, inventory.heldPrep, inventory.heldFreshness ?? "fresh");
});

function pocketLabel(kind: string | null): string {
  if (!kind) return t("gear.empty");
  return t(`item.${kind}`);
}

function emptyLabelStyle(label: string | null): string {
  return label == t("gear.empty") ? "opacity: 0.5" : "";
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
  <div id="gear" :hidden="!session.alive">
    <button type="button" class="gear-slot" data-slot="hands" @click="ui.queuePocket('hands')">
      <span class="gear-label">{{ mobileUi ? t("gear.handsShort") : t("gear.hands") }}</span>
      <span class="gear-item" :style="emptyLabelStyle(handsLabel)">
        {{ handsLabel }}
      </span>
    </button>
    <button type="button" class="gear-slot" data-slot="left" @click="ui.queuePocket('left')">
      <span class="gear-label">{{ mobileUi ? t("gear.pocketLeftShort") : t("gear.pocketLeft") }}</span>
      <span class="gear-item" :style="emptyLabelStyle(pocketLabel(inventory.left))">
        {{ pocketLabel(inventory.left) }}
      </span>
    </button>
    <button type="button" class="gear-slot" data-slot="right" @click="ui.queuePocket('right')">
      <span class="gear-label">{{ mobileUi ? t("gear.pocketRightShort") : t("gear.pocketRight") }}</span>
      <span class="gear-item" :style="emptyLabelStyle(pocketLabel(inventory.right))">
        {{ pocketLabel(inventory.right) }}
      </span>
    </button>
  </div>
</template>
