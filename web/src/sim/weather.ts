import { DAY_SECONDS } from "@/web/src/constants";

/** Island-hour windows (0–24). First squall hits ~30s after an 08:00 spawn. */
const WINDOWS: { start: number; end: number; storm: boolean }[] = [
  { start: 9.5, end: 13.6, storm: false },
  { start: 16.4, end: 18.1, storm: false },
  { start: 20.4, end: 23.2, storm: true },
];

const RAMP_IN = 3.5;
const RAMP_OUT = 6.5;

function hourOf(t: number): number {
  return ((t % 1) + 1) % 1 * 24;
}

function inWindow(hour: number): { storm: boolean } | null {
  for (const w of WINDOWS) {
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
  private thunderIn = 12;

  update(dt: number, dayT: number): void {
    const hour = hourOf(dayT);
    const win = inWindow(hour);
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
  secondsUntilRain(dayT: number): number {
    const hour = hourOf(dayT);
    for (const w of WINDOWS) {
      if (hour < w.start) return ((w.start - hour) / 24) * DAY_SECONDS;
    }
    return ((24 - hour + WINDOWS[0]!.start) / 24) * DAY_SECONDS;
  }
}
