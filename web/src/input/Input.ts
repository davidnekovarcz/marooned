import type { PocketSlot } from "@/web/src/world/kinds";

/** Camera-relative grid steps for the SW isometric view (screen up = world +X+Z). */
const DIRS: Record<string, { x: number; z: number }> = {
  KeyW: { x: 1, z: 1 },
  ArrowUp: { x: 1, z: 1 },
  KeyS: { x: -1, z: -1 },
  ArrowDown: { x: -1, z: -1 },
  KeyA: { x: 1, z: -1 },
  ArrowLeft: { x: 1, z: -1 },
  KeyD: { x: -1, z: 1 },
  ArrowRight: { x: -1, z: 1 },
};

const SHIFT = new Set(["ShiftLeft", "ShiftRight"]);

export type PocketCommand = "hands" | PocketSlot | "drop";

function isZoomIn(e: KeyboardEvent): boolean {
  return e.key === "+" || e.key === "=" || e.code === "NumpadAdd";
}

function isZoomOut(e: KeyboardEvent): boolean {
  return e.key === "-" || e.key === "_" || e.code === "NumpadSubtract";
}

export class Input {
  sprinting = false;
  zoomDir = 0;
  private pressed = new Set<string>();
  private interactQueued = false;
  private pocketQueued: PocketCommand | null = null;

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (SHIFT.has(e.code)) this.sprinting = true;
      if (e.code in DIRS) {
        e.preventDefault();
        this.pressed.add(e.code);
      }
      if (isZoomIn(e)) {
        e.preventDefault();
        this.zoomDir = -1;
      } else if (isZoomOut(e)) {
        e.preventDefault();
        this.zoomDir = 1;
      }
      if ((e.code === "Space" || e.key === " ") && !e.repeat) {
        e.preventDefault();
        this.interactQueued = true;
      }
      const pocket = this.hotkey(e);
      if (pocket) {
        e.preventDefault();
        this.pocketQueued = pocket;
      }
    });
    window.addEventListener("keyup", (e) => {
      if (SHIFT.has(e.code)) this.sprinting = false;
      this.pressed.delete(e.code);
      if (isZoomIn(e) && this.zoomDir < 0) this.zoomDir = 0;
      if (isZoomOut(e) && this.zoomDir > 0) this.zoomDir = 0;
    });
  }

  /** Combined WASD / arrows, each axis clamped to -1 / 0 / +1. */
  moveDir(): { x: number; z: number } | null {
    let x = 0;
    let z = 0;
    for (const code of this.pressed) {
      const dir = DIRS[code];
      if (!dir) continue;
      x += dir.x;
      z += dir.z;
    }
    x = Math.max(-1, Math.min(1, x));
    z = Math.max(-1, Math.min(1, z));
    if (x === 0 && z === 0) return null;
    return { x, z };
  }

  consumeInteract(): boolean {
    const next = this.interactQueued;
    this.interactQueued = false;
    return next;
  }

  consumePocket(): PocketCommand | null {
    const next = this.pocketQueued;
    this.pocketQueued = null;
    return next;
  }

  private hotkey(e: KeyboardEvent): PocketCommand | null {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return null;
    if (e.code === "Digit1" || e.code === "Numpad1") return "left";
    if (e.code === "Digit2" || e.code === "Numpad2") return "right";
    if (e.code === "Digit0" || e.code === "Numpad0") return "hands";
    if (e.code === "KeyG") return "drop";
    return null;
  }
}
