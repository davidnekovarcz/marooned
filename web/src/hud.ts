export type WeatherKind = "sun" | "sunCloud" | "cloud" | "rain" | "storm";

export type HudState = {
  weather: WeatherKind;
  clock: string;
  energy: number;
  thirst: number;
  hunger: number;
  temperature: number;
  health: number;
};

type NeedId = "energy" | "thirst" | "hunger" | "temperature" | "health";

const WEATHER_SVG: Record<WeatherKind, string> = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/><path d="M12 2v2.4M12 19.6V22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2 12h2.4M19.6 12H22M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/></svg>`,
  sunCloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3" fill="currentColor" stroke="none"/><path d="M8 2.5V4M3.5 8H2M4.1 4.1 5.2 5.2M4.1 11.9 5.2 10.8"/><path d="M8.2 16.2a4.2 4.2 0 0 1 .4-8.2 5 5 0 0 1 9.6 1.5A3.8 3.8 0 1 1 18 16.2Z" fill="currentColor" fill-opacity=".35"/></svg>`,
  cloud: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.6 18a5.2 5.2 0 0 1 .5-10.2 6.1 6.1 0 0 1 11.7 1.8A4.6 4.6 0 1 1 19.5 18Z" opacity=".9"/></svg>`,
  rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7.6 14.2a4.6 4.6 0 0 1 .5-9 5.4 5.4 0 0 1 10.4 1.6A4.1 4.1 0 1 1 18.4 14.2Z" fill="currentColor" fill-opacity=".35"/><path d="m8.5 16.5-1 3.2M12 16.8l-1 3.2M15.6 16.5l-1 3.2"/></svg>`,
  storm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.6 13.4a4.6 4.6 0 0 1 .5-9 5.4 5.4 0 0 1 10.4 1.6A4.1 4.1 0 1 1 18.4 13.4Z" fill="currentColor" fill-opacity=".35"/><path d="m11.2 12.8 2.2 3.4h-2.4L13 20"/></svg>`,
};

const NEED_SVG: Record<NeedId, string> = {
  energy: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.2 2 6 13.2h5.1L9.8 22 19 10.2h-5.4L13.2 2Z"/></svg>`,
  thirst: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2c0 0-6.2 7.1-6.2 11.2A6.2 6.2 0 0 0 12 20.6a6.2 6.2 0 0 0 6.2-6.2C18.2 10.3 12 3.2 12 3.2Z"/></svg>`,
  hunger: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.2c1.1 0 2.4 1.5 2.8 2.4.6-.2 1.6-.2 2.2.4 1.4 1.4.6 4.2-1.1 6.2C14.4 15 12.8 16.4 12 19.4 11.2 16.4 9.6 15 8.1 13.2 6.4 11.2 5.6 8.4 7 7c.6-.6 1.6-.6 2.2-.4.4-.9 1.7-2.4 2.8-2.4Z"/></svg>`,
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
  }

  let lastWeather: WeatherKind | null = null;

  return {
    update: (state) => {
      if (state.weather !== lastWeather) {
        lastWeather = state.weather;
        weatherEl.dataset.weather = state.weather;
        weatherEl.innerHTML = WEATHER_SVG[state.weather];
      }
      clockEl.textContent = state.clock;
      for (const id of NEED_ORDER) {
        const fill = fills.get(id);
        if (fill) fill.style.setProperty("--fill", `${Math.round(clamp01(state[id]) * 100)}%`);
      }
    },
  };
}
