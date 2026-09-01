export type SkyKind = "sun" | "moon";

export type HudState = {
  sky: SkyKind;
  clock: string;
  energy: number;
  thirst: number;
  hunger: number;
  temperature: number;
  health: number;
};

type NeedId = "energy" | "thirst" | "hunger" | "temperature" | "health";

const SKY_SVG: Record<SkyKind, string> = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/><path d="M12 2v2.4M12 19.6V22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2 12h2.4M19.6 12H22M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.2 3.1A8.4 8.4 0 1 0 20.8 15 7.2 7.2 0 0 1 14.2 3.1Z"/></svg>`,
};

const NEED_SVG: Record<NeedId, string> = {
  energy: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.2 2 6 13.2h5.1L9.8 22 19 10.2h-5.4L13.2 2Z"/></svg>`,
  thirst: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2c0 0-6.2 7.1-6.2 11.2A6.2 6.2 0 0 0 12 20.6a6.2 6.2 0 0 0 6.2-6.2C18.2 10.3 12 3.2 12 3.2Z"/></svg>`,
  hunger: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.2 3.2c.2 1.4 1.3 2.6 2.7 3.1-.9.3-1.9.3-2.7 0C11.4 4.8 10.4 3.8 10 2.6c.8.1 1.6.3 2.2.6Z"/><path d="M12 7.2c-1.1 0-2.1.3-2.9.8C7.2 9 6 10.8 6 13.2c0 3.2 2.4 6.6 6 6.6s6-3.4 6-6.6c0-2.4-1.2-4.2-3.1-5.2-.8-.5-1.8-.8-2.9-.8Z"/></svg>`,
  temperature: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 13.4V6.6a2 2 0 1 1 4 0v6.8a3.4 3.4 0 1 1-4 0Z"/><path d="M12 15.6V18"/></svg>`,
  health: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.2 4.8 13A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 7.2 6.2L12 20.2Z"/></svg>`,
};

const NEED_ORDER: NeedId[] = ["energy", "thirst", "hunger", "temperature", "health"];

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
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
        if (fill) fill.style.setProperty("--fill", `${Math.round(clamp01(state[id]) * 100)}%`);
      }
      const tempCell = cells.get("temperature");
      if (tempCell) {
        const t = clamp01(state.temperature);
        tempCell.dataset.temp = t > 0.8 ? "hot" : t > 0.6 ? "warm" : t < 0.4 ? "cold" : "ok";
      }
    },
  };
}
