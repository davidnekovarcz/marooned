/** Europe/Prague calendar day, `YYYY-MM-DD`. */
export function pragueDayKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export type Visit = {
  name: string;
  firstAt: number;
  lastAt: number;
  livedSeconds: number;
  dayKey: string;
  livedOffset: number;
};

export function parseVisit(raw: unknown): Visit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name : "";
  const firstAt = typeof o.firstAt === "number" && Number.isFinite(o.firstAt) ? o.firstAt : 0;
  const lastAt = typeof o.lastAt === "number" && Number.isFinite(o.lastAt) ? o.lastAt : 0;
  const livedSeconds = typeof o.livedSeconds === "number" && Number.isFinite(o.livedSeconds) ? Math.max(0, o.livedSeconds) : 0;
  const dayKey = typeof o.dayKey === "string" ? o.dayKey : "";
  const livedOffset = typeof o.livedOffset === "number" && Number.isFinite(o.livedOffset) ? Math.max(0, o.livedOffset) : 0;
  if (!firstAt && !lastAt && !name) return null;
  return { name, firstAt, lastAt, livedSeconds, dayKey, livedOffset };
}

/** Next visit row. A new Prague day keeps yesterday's total as the offset. */
export function nextVisit(prev: Visit | null, livedSeconds: number, name: string, now: number): Visit {
  const dayKey = pragueDayKey(now);
  const lived = Math.max(0, livedSeconds);
  if (!prev) {
    return { name, firstAt: now, lastAt: now, livedSeconds: lived, dayKey, livedOffset: 0 };
  }
  return {
    name: name || prev.name,
    firstAt: prev.firstAt || now,
    lastAt: now,
    livedSeconds: lived,
    dayKey,
    livedOffset: prev.dayKey === dayKey ? prev.livedOffset : prev.livedSeconds,
  };
}

/** Island seconds lived on `today`. Other days contribute nothing. */
export function livedTodaySeconds(visit: Visit, today: string): number {
  if (visit.dayKey !== today) return 0;
  return Math.max(0, visit.livedSeconds - visit.livedOffset);
}
