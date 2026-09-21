<script setup lang="ts">
import { computed } from "vue";
import { HUD_BAND_HIGH, HUD_BAND_LOW, HUD_BAND_MID, HUD_BLINK, HUD_ENERGY_MAX_BLINK, HUD_TEMP_HOT_BLINK } from "@/web/src/constants";
import { t } from "@/web/src/i18n";
import { useNeedsStore, usePlayerStore, useSessionStore } from "@/web/src/stores/game";

type NeedId = "energy" | "thirst" | "hunger" | "temperature" | "wetness" | "health";
type Tone = "ok" | "warn" | "alert" | "cold";
type Blink = "0" | "red" | "cold" | "fade";

const SKY_SVG = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/><path d="M12 2v2.4M12 19.6V22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2 12h2.4M19.6 12H22M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.2 3.1A8.4 8.4 0 1 0 20.8 15 7.2 7.2 0 0 1 14.2 3.1Z"/></svg>`,
  rain: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.2 9.2a5 5 0 0 1 9.5-1.6A4.2 4.2 0 1 1 17 17.5H8.2A4.2 4.2 0 0 1 7.2 9.2Z" opacity=".95"/><path d="M8.2 19.2 7 22M12 19.2 10.8 22M15.8 19.2 14.6 22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  storm: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.2 8.8a5 5 0 0 1 9.5-1.6A4.2 4.2 0 1 1 17 16.6H8.2A4.2 4.2 0 0 1 7.2 8.8Z"/><path d="M11.2 13.2 8.8 18h3.1L10.2 22 15.4 16.2h-3.1Z"/></svg>`,
};

const NEED_SVG: Record<NeedId, string> = {
  energy: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.2 2 6 13.2h5.1L9.8 22 19 10.2h-5.4L13.2 2Z"/></svg>`,
  thirst: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.2 2.4h5.6v2.1l1.5 2.4c.4.7.6 1.5.6 2.3V18.4a3.4 3.4 0 0 1-3.4 3.4h-3.6A3.4 3.4 0 0 1 7.1 18.4V9.2c0-.8.2-1.6.6-2.3l1.5-2.4V2.4Z"/><path d="M10 2.4h4v1.5h-4Z" opacity=".9"/><path d="M10.2 11.4h3.6v7.2c0 .7-.6 1.2-1.3 1.2h-1c-.7 0-1.3-.5-1.3-1.2v-7.2Z" opacity=".4"/></svg>`,
  hunger: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.2 2.2c1.3.15 2.6.9 3.3 2.1-1.6.05-3 .7-3.8 1.7-.7-1.2-.7-2.6.5-3.8Z"/><path d="M12.15 6.35c.2-1.55.85-2.7 1.85-3.45-.25 1.45-.55 2.45-1.85 3.45Z"/><path d="M12 8.55c-1.55-1.85-4.85-1.45-5.9 1.35-1.05 2.85.15 6.85 2.45 9.15 1.25 1.25 2.35 1.55 3.45 1.55s2.2-.3 3.45-1.55c2.3-2.3 3.5-6.3 2.45-9.15-1.05-2.8-4.35-3.2-5.9-1.35Z"/></svg>`,
  temperature: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 13.4V6.6a2 2 0 1 1 4 0v6.8a3.4 3.4 0 1 1-4 0Z"/><path d="M12 15.6V18"/></svg>`,
  wetness: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.4s-6 6.8-6 10.4a6 6 0 1 0 12 0C18 10.2 12 3.4 12 3.4Z"/></svg>`,
  health: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.2 4.8 13A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 7.2 6.2L12 20.2Z"/></svg>`,
};

const NEED_ORDER: NeedId[] = ["energy", "wetness", "hunger", "thirst", "temperature", "health"];

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function supplyTone(v: number): Tone {
  if (v < HUD_BAND_LOW) return "alert";
  if (v < HUD_BAND_MID) return "warn";
  return "ok";
}

function healthTone(v: number): Tone {
  if (v < HUD_BAND_MID) return "alert";
  if (v < 1) return "warn";
  return "ok";
}

function tempTone(v: number): Tone {
  if (v > HUD_BAND_HIGH) return "alert";
  if (v > HUD_BAND_MID) return "warn";
  if (v < HUD_BAND_LOW) return "cold";
  return "ok";
}

const session = useSessionStore();
const needs = useNeedsStore();
const player = usePlayerStore();
const debugCells = new URLSearchParams(window.location.search).has("debug");

const skySvg = computed(() => SKY_SVG[session.sky]);

function needValue(id: NeedId): number {
  return clamp01(needs[id]);
}

function needTone(id: NeedId): Tone {
  const v = needValue(id);
  if (id === "energy") return "ok";
  if (id === "temperature") return tempTone(v);
  if (id === "wetness") return v > HUD_BAND_HIGH ? "alert" : v > HUD_BAND_MID ? "warn" : "ok";
  if (id === "health") return healthTone(v);
  return supplyTone(v);
}

function needBlink(id: NeedId): Blink {
  if (session.afk) return "0";
  const v = needValue(id);
  if (id === "energy") {
    if (needs.energyMax < HUD_ENERGY_MAX_BLINK) return "fade";
  } else if (id === "temperature") {
    if (v > HUD_TEMP_HOT_BLINK) return "red";
    if (v < HUD_BLINK) return "cold";
  } else if (id === "wetness") {
    if (v > HUD_BAND_HIGH) return "cold";
  } else if (v < HUD_BLINK) {
    if (id === "health" || id === "thirst" || id === "hunger") return "red";
  }
  return "0";
}
</script>

<template>
  <div id="hud-world" aria-hidden="true">
    <div id="hud-weather" :data-sky="session.sky" v-html="skySvg" />
    <time id="hud-clock" :data-cell="`${player.cellX},${player.cellZ}`">
      {{ session.clock }}<template v-if="debugCells"> {{ player.cellX }},{{ player.cellZ }}</template>
    </time>
  </div>
  <div id="hud-needs" aria-hidden="true" :data-afk="session.afk || undefined">
    <div
      v-for="id in NEED_ORDER"
      :key="id"
      class="need"
      :data-need="id"
      :data-tone="needTone(id)"
      :data-blink="needBlink(id)"
      :title="t(`hud.need.${id}`)"
    >
      <div class="need-fill" :style="{ '--fill': `${Math.round(needValue(id) * 100)}%` }" />
      <div class="need-icon" v-html="NEED_SVG[id]" />
    </div>
  </div>
</template>
