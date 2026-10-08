import { DAY_SECONDS } from "@/web/src/constants";

type Window = { start: number; end: number; storm: boolean };

/** Morning + afternoon showers every day; night storm every fourth day (index 3, 7, …). */
function windowsForDay(dayIndex: number): Window[] {
  const showers: Window[] = [
    { start: 9 + 30 / 60, end: 11, storm: false },
    { start: 14 + 20 / 60, end: 16 + 30 / 60, storm: false },
  ];
  const storm = ((dayIndex % 4) + 4) % 4 === 3;
  if (storm) showers.push({ start: 20 + 30 / 60, end: 22 + 40 / 60, storm: true });
  return showers;
}

const RAMP_IN = 3.5;
const RAMP_OUT = 6.5;

function hourOf(t: number): number {
  return ((((t % 1) + 1) % 1) * 24);
}

function dayIndexOf(elapsed: number): number {
  return Math.floor(Math.max(0, elapsed) / DAY_SECONDS);
}

function inWindow(hour: number, windows: Window[]): Window | null {
  for (const w of windows) {
    if (hour >= w.start && hour < w.end) return w;
  }
  return null;
}

export type SkyKind = "sun" | "moon" | "rain" | "storm";

export class Weather {
  intensity = 0;
  raining = false;
  storm = false;
  /** Seconds since rain last stopped — fireflies live in this afterglow. */
  afterglow = 99;
  flash = 0;
  /** QA pin so walks can force rain or a dry sky without waiting on the clock. */
  pinned: "rain" | "clear" | null = null;
  private thunderIn = 12;

  update(dt: number, dayT: number, elapsed = 0): void {
    if (this.pinned === "rain") {
      this.intensity = 1;
      this.raining = true;
      this.storm = false;
      this.afterglow = 0;
      return;
    }
    if (this.pinned === "clear") {
      this.intensity = 0;
      this.raining = false;
      this.storm = false;
      this.afterglow = 99;
      return;
    }
    const hour = hourOf(dayT);
    const win = inWindow(hour, windowsForDay(dayIndexOf(elapsed)));
    const want = win ? 1 : 0;
    const ramp = want > this.intensity ? RAMP_IN : RAMP_OUT;
    const step = dt / ramp;
    if (want > this.intensity) this.intensity = Math.min(1, this.intensity + step);
    else this.intensity = Math.max(0, this.intensity - step);

    const wasRaining = this.raining;
    this.raining = this.intensity > 0.08;
    this.storm = Boolean(win?.storm) && this.intensity > 0.45;
    if (this.raining) this.afterglow = 0;
    else this.afterglow += dt;

    if (wasRaining && !this.raining) this.flash = 0;

    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (this.raining && this.intensity > 0.55) {
      this.thunderIn -= dt;
      if (this.thunderIn <= 0) {
        this.flash = this.storm ? 1 : 0.62;
        this.thunderIn = 7 + Math.random() * (this.storm ? 10 : 16);
      }
    }
  }

  soaking(): number {
    return this.intensity;
  }

  fireflies(night: boolean): boolean {
    return night && !this.raining && this.afterglow < 90 && this.afterglow > 4;
  }

  sky(daytime: boolean): SkyKind {
    if (this.storm && this.intensity > 0.4) return "storm";
    if (this.raining) return "rain";
    return daytime ? "sun" : "moon";
  }

  /** Real seconds until the next shower starts (for debug / first-rain feel). */
  secondsUntilRain(dayT: number, elapsed = 0): number {
    const hour = hourOf(dayT);
    let day = dayIndexOf(elapsed);
    const remaining = hour;
    for (let ahead = 0; ahead < 8; ahead += 1) {
      const windows = windowsForDay(day);
      for (const w of windows) {
        if (ahead === 0 && remaining >= w.start) continue;
        const hours = ahead === 0 ? w.start - remaining : 24 - remaining + w.start + (ahead - 1) * 24;
        return (hours / 24) * DAY_SECONDS;
      }
      day += 1;
    }
    return DAY_SECONDS;
  }
}
