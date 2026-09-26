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
export type MoveDir = { x: number; z: number };

function isZoomIn(e: KeyboardEvent): boolean {
  return e.key === "+" || e.key === "=" || e.code === "NumpadAdd";
}

function isZoomOut(e: KeyboardEvent): boolean {
  return e.key === "-" || e.key === "_" || e.code === "NumpadSubtract";
}

export class Input {
  private keyboardSprint = false;
  private keyboardZoom = 0;
  private virtualMove: MoveDir | null = null;
  private virtualSprint = false;
  private virtualZoom = 0;
  private composing = false;
  private pressed = new Set<string>();
  private interactQueued = false;
  private pocketQueued: PocketCommand | null = null;
  private openChatQueued = false;
  private sendChatQueued = false;
  private cancelChatQueued = false;

  get sprinting(): boolean {
    return this.virtualSprint || this.keyboardSprint;
  }

  get zoomDir(): number {
    return this.virtualZoom !== 0 ? this.virtualZoom : this.keyboardZoom;
  }

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Enter" && !e.repeat) {
        e.preventDefault();
        if (this.composing) this.sendChatQueued = true;
        else this.openChatQueued = true;
        return;
      }
      if (e.code === "Escape" && this.composing) {
        e.preventDefault();
        this.cancelChatQueued = true;
        return;
      }
      if (SHIFT.has(e.code)) this.keyboardSprint = true;
      if (isZoomIn(e)) {
        e.preventDefault();
        this.keyboardZoom = -1;
      } else if (isZoomOut(e)) {
        e.preventDefault();
        this.keyboardZoom = 1;
      }
      if (this.composing) return;
      if (e.code in DIRS) {
        e.preventDefault();
        this.pressed.add(e.code);
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
      if (SHIFT.has(e.code)) this.keyboardSprint = false;
      this.pressed.delete(e.code);
      if (isZoomIn(e) && this.keyboardZoom < 0) this.keyboardZoom = 0;
      if (isZoomOut(e) && this.keyboardZoom > 0) this.keyboardZoom = 0;
    });
  }

  /** Combined WASD / arrows / virtual stick, each axis clamped to -1 / 0 / +1. */
  moveDir(): MoveDir | null {
    if (this.virtualMove) return this.virtualMove;
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

  setVirtualMove(dir: MoveDir | null): void {
    this.virtualMove = dir;
  }

  setVirtualSprint(on: boolean): void {
    this.virtualSprint = on;
  }

  setZoomDir(dir: number): void {
    this.virtualZoom = dir < 0 ? -1 : dir > 0 ? 1 : 0;
  }

  clearVirtual(): void {
    this.virtualMove = null;
    this.virtualSprint = false;
    this.virtualZoom = 0;
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

  setComposing(on: boolean): void {
    this.composing = on;
    if (on) {
      this.pressed.clear();
      this.clearVirtual();
    }
  }

  consumeOpenChat(): boolean {
    const next = this.openChatQueued;
    this.openChatQueued = false;
    return next;
  }

  consumeSendChat(): boolean {
    const next = this.sendChatQueued;
    this.sendChatQueued = false;
    return next;
  }

  consumeCancelChat(): boolean {
    const next = this.cancelChatQueued;
    this.cancelChatQueued = false;
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
