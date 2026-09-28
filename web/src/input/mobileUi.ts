/** Narrow phone, or coarse pointer on a tablet-sized screen — not wide desktop. */
const QUERY = "(max-width: 768px), ((pointer: coarse) and (max-width: 1100px))";

type Listener = (on: boolean) => void;

const listeners = new Set<Listener>();
let mql: MediaQueryList | null = null;
let current = false;

function sync(): void {
  if (!mql) return;
  current = mql.matches;
  document.body.classList.toggle("mobile-ui", current);
  for (const fn of listeners) fn(current);
}

function ensureWatch(): void {
  if (typeof window === "undefined" || mql) return;
  mql = window.matchMedia(QUERY);
  current = mql.matches;
  document.body.classList.toggle("mobile-ui", current);
  mql.addEventListener("change", sync);
}

export function isMobileUi(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(QUERY).matches;
}

/** Keep `body.mobile-ui` in sync; returns unsubscribe. */
export function watchMobileUi(onChange: Listener): () => void {
  ensureWatch();
  listeners.add(onChange);
  onChange(current);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && mql) {
      mql.removeEventListener("change", sync);
      mql = null;
      document.body.classList.remove("mobile-ui");
    }
  };
}
