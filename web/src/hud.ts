import { HUD_BAND_HIGH, HUD_BAND_LOW, HUD_BAND_MID, HUD_BLINK, HUD_ENERGY_MAX_BLINK, HUD_TEMP_HOT_BLINK } from "./constants";

export type SkyKind = "sun" | "moon";

export type HudState = {
  sky: SkyKind;
  clock: string;
  energy: number;
  energyMax: number;
  thirst: number;
  hunger: number;
  temperature: number;
  health: number;
};

type NeedId = "energy" | "thirst" | "hunger" | "temperature" | "health";
type Tone = "ok" | "warn" | "alert" | "cold";
type Blink = "0" | "red" | "cold" | "fade";

const SKY_SVG: Record<SkyKind, string> = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/><path d="M12 2v2.4M12 19.6V22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2 12h2.4M19.6 12H22M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.2 3.1A8.4 8.4 0 1 0 20.8 15 7.2 7.2 0 0 1 14.2 3.1Z"/></svg>`,
};

const NEED_SVG: Record<NeedId, string> = {
  energy: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.2 2 6 13.2h5.1L9.8 22 19 10.2h-5.4L13.2 2Z"/></svg>`,
  thirst: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2c0 0-6.2 7.1-6.2 11.2A6.2 6.2 0 0 0 12 20.6a6.2 6.2 0 0 0 6.2-6.2C18.2 10.3 12 3.2 12 3.2Z"/></svg>`,
  hunger: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.2 2.2c1.3.15 2.6.9 3.3 2.1-1.6.05-3 .7-3.8 1.7-.7-1.2-.7-2.6.5-3.8Z"/><path d="M12.15 6.35c.2-1.55.85-2.7 1.85-3.45-.25 1.45-.55 2.45-1.85 3.45Z"/><path d="M12 8.55c-1.55-1.85-4.85-1.45-5.9 1.35-1.05 2.85.15 6.85 2.45 9.15 1.25 1.25 2.35 1.55 3.45 1.55s2.2-.3 3.45-1.55c2.3-2.3 3.5-6.3 2.45-9.15-1.05-2.8-4.35-3.2-5.9-1.35Z"/></svg>`,
  temperature: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 13.4V6.6a2 2 0 1 1 4 0v6.8a3.4 3.4 0 1 1-4 0Z"/><path d="M12 15.6V18"/></svg>`,
  health: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.2 4.8 13A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 7.2 6.2L12 20.2Z"/></svg>`,
};

const NEED_ORDER: NeedId[] = ["energy", "thirst", "hunger", "temperature", "health"];

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** High is good: energy, thirst, hunger. */
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

export function createHud(): { update: (state: HudState) => void } {
  const weatherEl = document.getElementById("hud-weather");
  const clockEl = document.getElementById("hud-clock");
  const needsRoot = document.getElementById("hud-needs");
  if (!weatherEl || !clockEl || !needsRoot) {
    throw new Error("HUD markup missing from index.html");
  }

  needsRoot.replaceChildren();
  const fills = new Map<NeedId, HTMLElement>();
  const cells = new Map<NeedId, HTMLElement>();
  for (const id of NEED_ORDER) {
    const cell = document.createElement("div");
    cell.className = "need";
    cell.dataset.need = id;
    cell.title = id;
    const fill = document.createElement("div");
    fill.className = "need-fill";
    const icon = document.createElement("div");
    icon.className = "need-icon";
    icon.innerHTML = NEED_SVG[id];
    cell.append(fill, icon);
    needsRoot.append(cell);
    fills.set(id, fill);
    cells.set(id, cell);
  }

  let lastSky: SkyKind | null = null;

  return {
    update: (state) => {
      if (state.sky !== lastSky) {
        lastSky = state.sky;
        weatherEl.dataset.sky = state.sky;
        weatherEl.innerHTML = SKY_SVG[state.sky];
      }
      clockEl.textContent = state.clock;
      for (const id of NEED_ORDER) {
        const fill = fills.get(id);
        const cell = cells.get(id);
        const v = clamp01(state[id]);
        if (fill) fill.style.setProperty("--fill", `${Math.round(v * 100)}%`);
        if (!cell) continue;
        if (id === "energy") cell.dataset.tone = "ok";
        else if (id === "temperature") cell.dataset.tone = tempTone(v);
        else if (id === "health") cell.dataset.tone = healthTone(v);
        else cell.dataset.tone = supplyTone(v);
        let blink: Blink = "0";
        if (id === "energy") {
          if (state.energyMax < HUD_ENERGY_MAX_BLINK) blink = "fade";
        } else if (id === "temperature") {
          if (v > HUD_TEMP_HOT_BLINK) blink = "red";
          else if (v < HUD_BLINK) blink = "cold";
        } else if (v < HUD_BLINK) {
          if (id === "health" || id === "thirst" || id === "hunger") blink = "red";
        }
        cell.dataset.blink = blink;
      }
    },
  };
}

function unitLabel(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

export function formatDeathMessage(gameHours: number): string {
  const totalMinutes = Math.max(0, Math.floor(gameHours * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `You have survived ${unitLabel(hours, "hour", "hours")} + ${unitLabel(minutes, "minute", "minutes")}... but now you're dead.`;
}

export function showDeathScreen(gameHours: number): void {
  const overlay = document.getElementById("death");
  const message = document.getElementById("death-message");
  const retry = document.getElementById("death-retry");
  if (!overlay || !message || !retry) return;
  document.body.classList.add("dead");
  message.textContent = formatDeathMessage(gameHours);
  overlay.hidden = false;
  retry.addEventListener("click", () => window.location.reload(), { once: true });
}
