import * as THREE from "three";

const HEAD_Y = 1.95;
const _v = new THREE.Vector3();

type Chip = {
  root: HTMLDivElement;
  sayEl: HTMLSpanElement;
  nameEl: HTMLSpanElement;
  zzzEl: HTMLSpanElement;
};

const pool: Chip[] = [];

export type PlayerChipState = {
  object: THREE.Object3D;
  name: string;
  afk: boolean;
  alive: boolean;
  say?: string | null;
};

function makeChip(): Chip {
  const root = document.createElement("div");
  root.className = "player-chip";
  root.hidden = true;
  const sayEl = document.createElement("span");
  sayEl.className = "player-chip-say";
  sayEl.hidden = true;
  const nameEl = document.createElement("span");
  nameEl.className = "player-chip-name";
  const zzzEl = document.createElement("span");
  zzzEl.className = "player-chip-zzz";
  zzzEl.textContent = "😴";
  zzzEl.hidden = true;
  root.append(sayEl, nameEl, zzzEl);
  (document.getElementById("ui") ?? document.body).appendChild(root);
  return { root, sayEl, nameEl, zzzEl };
}

/** Screen-space name + AFK chip. Fog and zoom cannot eat a DOM label. */
export function syncPlayerChips(
  states: PlayerChipState[],
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
): void {
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;
  let used = 0;
  for (const state of states) {
    if (!state.alive) continue;
    const chip = pool[used] ?? (pool[used] = makeChip());
    used += 1;
    const say = state.afk ? "" : (state.say ?? "").trim();
    chip.nameEl.textContent = state.name.trim() || "Survivor";
    chip.nameEl.hidden = state.afk;
    chip.zzzEl.hidden = !state.afk;
    chip.sayEl.textContent = say;
    chip.sayEl.hidden = !say;
    state.object.getWorldPosition(_v);
    _v.y += HEAD_Y;
    _v.project(camera);
    const onScreen = _v.z >= -1 && _v.z <= 1 && Math.abs(_v.x) <= 1.15 && Math.abs(_v.y) <= 1.15;
    chip.root.hidden = !onScreen;
    if (!onScreen) continue;
    chip.root.style.left = `${(_v.x * 0.5 + 0.5) * w}px`;
    chip.root.style.top = `${(-_v.y * 0.5 + 0.5) * h}px`;
  }
  for (let i = used; i < pool.length; i++) pool[i]!.root.hidden = true;
}
