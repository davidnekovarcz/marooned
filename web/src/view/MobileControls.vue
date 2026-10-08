<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { MoveDir } from "@/web/src/input/Input";
import { mobileInput } from "@/web/src/input/mobileBind";
import { watchMobileUi } from "@/web/src/input/mobileUi";
import { useSessionStore, useUiStore } from "@/web/src/stores/game";

const DEAD = 0.28;
const SPRINT = 0.65;
const MAX = 52;

/** Screen-up is world +X+Z (same as WASD). Normalized so 8-way dots stay fair. */
const OCTANTS: MoveDir[] = [
  { x: 1, z: 1 },
  { x: -1, z: 1 },
  { x: -1, z: -1 },
  { x: 1, z: -1 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
  { x: 0, z: -1 },
  { x: 1, z: 0 },
].map((o) => {
  const len = Math.hypot(o.x, o.z) || 1;
  return { x: o.x / len, z: o.z / len };
});

const session = useSessionStore();
const ui = useUiStore();

const mobileUi = ref(false);
const knobX = ref(0);
const knobY = ref(0);
const stickActive = ref(false);

const visible = computed(
  () => mobileUi.value && session.alive && !ui.dead && !ui.islandFull && !ui.chatOpen,
);

let pointerId: number | null = null;
let centerX = 0;
let centerY = 0;
let stopWatch: (() => void) | null = null;

function quantize(nx: number, ny: number): MoveDir {
  const wx = -ny - nx;
  const wz = -ny + nx;
  let best = OCTANTS[0]!;
  let bestDot = -Infinity;
  for (const o of OCTANTS) {
    const dot = wx * o.x + wz * o.z;
    if (dot > bestDot) {
      bestDot = dot;
      best = o;
    }
  }
  // Snap back to grid steps (-1/0/1), not unit vectors.
  return {
    x: Math.max(-1, Math.min(1, Math.round(best.x * Math.SQRT2))) as -1 | 0 | 1,
    z: Math.max(-1, Math.min(1, Math.round(best.z * Math.SQRT2))) as -1 | 0 | 1,
  };
}

function applyStick(clientX: number, clientY: number): void {
  const input = mobileInput();
  if (!input) return;
  let dx = clientX - centerX;
  let dy = clientY - centerY;
  const len = Math.hypot(dx, dy);
  if (len > MAX) {
    dx = (dx / len) * MAX;
    dy = (dy / len) * MAX;
  }
  knobX.value = dx;
  knobY.value = dy;
  const mag = Math.min(1, Math.hypot(dx, dy) / MAX);
  if (mag < DEAD) {
    input.setVirtualMove(null);
    input.setVirtualSprint(false);
    return;
  }
  input.setVirtualMove(quantize(dx / MAX, dy / MAX));
  input.setVirtualSprint(mag >= SPRINT);
}

function onStickDown(e: PointerEvent): void {
  if (pointerId !== null) return;
  const el = e.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  centerX = rect.left + rect.width / 2;
  centerY = rect.top + rect.height / 2;
  pointerId = e.pointerId;
  stickActive.value = true;
  el.setPointerCapture(e.pointerId);
  applyStick(e.clientX, e.clientY);
  e.preventDefault();
}

function onStickMove(e: PointerEvent): void {
  if (e.pointerId !== pointerId) return;
  applyStick(e.clientX, e.clientY);
  e.preventDefault();
}

function onStickUp(e: PointerEvent): void {
  if (e.pointerId !== pointerId) return;
  pointerId = null;
  stickActive.value = false;
  knobX.value = 0;
  knobY.value = 0;
  mobileInput()?.setVirtualMove(null);
  mobileInput()?.setVirtualSprint(false);
}

onMounted(() => {
  stopWatch = watchMobileUi((on) => {
    mobileUi.value = on;
    if (!on) mobileInput()?.clearVirtual();
  });
});

onUnmounted(() => {
  stopWatch?.();
  stopWatch = null;
  mobileInput()?.clearVirtual();
});
</script>

<template>
  <div id="mobile-controls" :hidden="!visible">
    <div
      id="mobile-stick"
      class="mobile-stick"
      :class="{ active: stickActive }"
      @pointerdown="onStickDown"
      @pointermove="onStickMove"
      @pointerup="onStickUp"
      @pointercancel="onStickUp"
    >
      <div
        class="mobile-stick-knob"
        :style="{ transform: `translate(${knobX}px, ${knobY}px)` }"
      />
    </div>
  </div>
</template>
