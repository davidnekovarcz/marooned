import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { Biome, CELL, GRID, GROUND_Y, POND_RADIUS, POND_X, POND_Z, SEED, WATER_Y } from "@/web/src/constants";
import { canEnter } from "@/web/src/gridOverlay";
import { cellIndex, inBounds, isLand } from "@/web/src/island";
import { loadFbx, loadGltfFile, prepareTemplate } from "@/web/src/loaders";
import { ANIMAL_URLS, FISH_URLS, WILD_URLS } from "@/web/src/models";
import { mulberry32 } from "@/web/src/rng";
import { type SizeSpec, ANIMAL_SIZE } from "@/web/src/scale";

const LAND_STEP = 0.95;
const FISH_STEP = 1.2;
const LAND_EACH = 2;
const FISH_EACH = 2;
const SPREAD = 12;
const HELPER_MESH = /PoleTarget|^IK|FFB?\.|Ctrl|shadow/i;
const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

type Template = { root: THREE.Object3D; clips: THREE.AnimationClip[] };

export type WildlifeKind = "fox" | "pig" | "deer" | "sheep" | "llama";

type Critter = {
  kind: WildlifeKind | "fish";
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction;
  walk: THREE.AnimationAction;
  cellX: number;
  cellZ: number;
  moving: boolean;
  t: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  wait: number;
  aquatic: boolean;
  stepSeconds: number;
};

function pickClip(clips: THREE.AnimationClip[], ...patterns: RegExp[]): THREE.AnimationClip | null {
  for (const pattern of patterns) {
    const hit = clips.find((clip) => pattern.test(clip.name));
    if (hit) return hit;
  }
  return clips[0] ?? null;
}

function makeInPlace(clip: THREE.AnimationClip): THREE.AnimationClip {
  const copy = clip.clone();
  copy.tracks = copy.tracks.filter((track) => track.name.endsWith(".quaternion"));
  return copy;
}

function inPondCell(x: number, z: number): boolean {
  return Math.hypot(x + 0.5 - POND_X, z + 0.5 - POND_Z) <= POND_RADIUS + 0.6;
}

function eachBodyMesh(root: THREE.Object3D, visit: (mesh: THREE.Mesh) => void): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || HELPER_MESH.test(mesh.name)) return;
    visit(mesh);
  });
}

function bodyBox(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  let any = false;
  root.updateMatrixWorld(true);
  eachBodyMesh(root, (mesh) => {
    const skinned = mesh as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) skinned.skeleton.update();
    box.expandByObject(mesh);
    any = true;
  });
  if (!any) box.setFromObject(root);
  return box;
}

function fitBody(root: THREE.Object3D, spec: SizeSpec): void {
  const size = bodyBox(root).getSize(new THREE.Vector3());
  const current = spec.axis === "height" ? size.y : Math.max(size.x, size.y, size.z);
  if (current < 1e-4) return;
  root.scale.multiplyScalar(Math.max(spec.meters, spec.min ?? 0) / current);
  root.updateMatrixWorld(true);
}

function plant(obj: THREE.Object3D, y: number): void {
  obj.position.y += y - bodyBox(obj).min.y;
}

function plantCenter(obj: THREE.Object3D, y: number): void {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const mid = (box.min.y + box.max.y) / 2;
  obj.position.y += y - mid;
}

function paintFish(root: THREE.Object3D, color: number): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    mesh.material = new THREE.MeshLambertMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
    });
  });
}

/** FBX farm animals often ship with opacity 0 / FrontSide, so only the shadow remains. */
function paintCritter(root: THREE.Object3D, fallback: number): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (/shadow/i.test(mesh.name)) {
      mesh.visible = false;
      mesh.castShadow = false;
      return;
    }
    mesh.visible = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const srcs = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = srcs.map((raw) => {
      const src = raw as THREE.MeshStandardMaterial;
      const mapped = Boolean(src.map);
      const hex = src.color && src.color.getHex() > 0x202020 ? src.color.getHex() : fallback;
      return new THREE.MeshLambertMaterial({
        color: mapped ? 0xffffff : hex,
        map: src.map ?? null,
        side: THREE.DoubleSide,
        transparent: false,
        opacity: 1,
        depthWrite: true,
      });
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0]!;
  });
}

async function templateFromFbx(url: string, spec: SizeSpec): Promise<Template> {
  const fbx = await loadFbx(url);
  prepareTemplate(fbx);
  fitBody(fbx, spec);
  return { root: fbx, clips: fbx.animations };
}

async function templateFromGltf(url: string, spec: SizeSpec): Promise<Template> {
  const loaded = await loadGltfFile(url);
  fitBody(loaded.root, spec);
  return { root: loaded.root, clips: loaded.animations };
}

function spawn(
  template: Template,
  kind: Critter["kind"],
  x: number,
  z: number,
  y: number,
  aquatic: boolean,
): Critter {
  const root = cloneSkinned(template.root);
  root.traverse((obj) => {
    obj.frustumCulled = false;
  });
  root.position.set(x * CELL + CELL / 2, 0, z * CELL + CELL / 2);
  if (aquatic) plantCenter(root, y);
  else plant(root, y);
  const mixer = new THREE.AnimationMixer(root);
  const idleSrc =
    pickClip(template.clips, /Idle(?!_Hit|_2_Head)/i, /Idle/i, /Swim/i) ??
    new THREE.AnimationClip("idle", 1, []);
  const walkSrc = aquatic
    ? pickClip(template.clips, /Swim/i, /Walk/i)
    : pickClip(template.clips, /Walk/i);
  const idle = mixer.clipAction(makeInPlace(idleSrc));
  idle.play();
  const walk =
    walkSrc && walkSrc !== idleSrc ? mixer.clipAction(makeInPlace(walkSrc)) : idle;
  if (walk !== idle) {
    walk.play();
    walk.setEffectiveWeight(0);
  }
  mixer.update(0);
  if (!aquatic) plant(root, y);
  return {
    kind,
    root,
    mixer,
    idle,
    walk,
    cellX: x,
    cellZ: z,
    moving: false,
    t: 0,
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    wait: 1.4 + Math.random() * 3.2,
    aquatic,
    stepSeconds: aquatic ? FISH_STEP : LAND_STEP,
  };
}

function setWalk(critter: Critter, walking: boolean): void {
  if (critter.walk === critter.idle) return;
  critter.walk.setEffectiveWeight(walking ? 1 : 0);
  critter.idle.setEffectiveWeight(walking ? 0 : 1);
}

function pickCell(
  rng: () => number,
  cells: [number, number][],
  ok: (x: number, z: number) => boolean,
): [number, number] | null {
  for (let i = 0; i < 80; i++) {
    const cell = cells[Math.floor(rng() * cells.length)];
    if (!cell) continue;
    if (ok(cell[0], cell[1])) return cell;
  }
  return null;
}

export async function spawnWildlife(
  scene: THREE.Scene,
  biomes: Uint8Array,
  blocked: Uint8Array,
): Promise<{
  update: (dt: number) => void;
  nearest: (cellX: number, cellZ: number, max?: number) => WildlifeKind | null;
}> {
  const rng = mulberry32(`${SEED}-wildlife`);
  const group = new THREE.Group();
  group.name = "wildlife";

  const grass: [number, number][] = [];
  const pond: [number, number][] = [];
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      const b = biomes[cellIndex(x, z)] as Biome;
      if (b === Biome.Grass && canEnter(biomes, blocked, x, z)) grass.push([x, z]);
      if (b === Biome.Water && inPondCell(x, z)) pond.push([x, z]);
    }
  }

  const [pig, sheep, llama, fox, deer, fish1, fish2, fish3] = await Promise.all([
    templateFromFbx(ANIMAL_URLS.pig, ANIMAL_SIZE.pig),
    templateFromFbx(ANIMAL_URLS.sheep, ANIMAL_SIZE.sheep),
    templateFromFbx(ANIMAL_URLS.llama, ANIMAL_SIZE.llama),
    templateFromGltf(WILD_URLS.fox, ANIMAL_SIZE.fox),
    templateFromGltf(WILD_URLS.deer, ANIMAL_SIZE.deer),
    templateFromFbx(FISH_URLS.fish1, { ...ANIMAL_SIZE.fish1, layFlat: true }),
    templateFromFbx(FISH_URLS.fish2, { ...ANIMAL_SIZE.fish2, layFlat: true }),
    templateFromFbx(FISH_URLS.fish3, { ...ANIMAL_SIZE.fish3, layFlat: true }),
  ]);
  paintCritter(pig.root, 0xe39aa4);
  paintCritter(sheep.root, 0xf2ebe0);
  paintCritter(llama.root, 0xc4a06a);
  paintCritter(fox.root, 0xc45a1a);
  paintCritter(deer.root, 0x9a6230);
  paintFish(fish1.root, 0xc45a3a);
  paintFish(fish2.root, 0x3a6ec8);
  paintFish(fish3.root, 0xe07020);

  const critters: Critter[] = [];
  const used: [number, number][] = [];
  const free = (x: number, z: number) =>
    used.every(([ux, uz]) => Math.max(Math.abs(x - ux), Math.abs(z - uz)) >= SPREAD);
  const placeLand = (template: Template, kind: WildlifeKind) => {
    for (let n = 0; n < LAND_EACH; n++) {
      const cell = pickCell(
        rng,
        grass,
        (x, z) =>
          free(x, z) && canEnter(biomes, blocked, x, z) && isLand(biomes[cellIndex(x, z)] as Biome),
      );
      if (!cell) continue;
      used.push(cell);
      const critter = spawn(template, kind, cell[0], cell[1], GROUND_Y, false);
      group.add(critter.root);
      critters.push(critter);
    }
  };
  const placeFish = (template: Template) => {
    for (let n = 0; n < FISH_EACH; n++) {
      const cell = pickCell(rng, pond, (x, z) => inPondCell(x, z));
      if (!cell) continue;
      const critter = spawn(template, "fish", cell[0], cell[1], WATER_Y + 0.28, true);
      group.add(critter.root);
      critters.push(critter);
    }
  };

  placeLand(pig, "pig");
  placeLand(sheep, "sheep");
  placeLand(llama, "llama");
  placeLand(fox, "fox");
  placeLand(deer, "deer");
  placeFish(fish1);
  placeFish(fish2);
  placeFish(fish3);

  scene.add(group);

  const landOk = (x: number, z: number) =>
    inBounds(x, z) && canEnter(biomes, blocked, x, z) && isLand(biomes[cellIndex(x, z)] as Biome);
  const waterOk = (x: number, z: number) => inPondCell(x, z);

  return {
    nearest: (cellX: number, cellZ: number, max = 2): WildlifeKind | null => {
      let best: WildlifeKind | null = null;
      let bestD = max;
      for (const critter of critters) {
        if (critter.kind === "fish") continue;
        const d = Math.max(Math.abs(cellX - critter.cellX), Math.abs(cellZ - critter.cellZ));
        if (d <= bestD) {
          best = critter.kind;
          bestD = d;
        }
      }
      return best;
    },
    update: (dt: number) => {
      for (const critter of critters) {
        critter.mixer.update(dt);
        if (critter.moving) {
          critter.t += dt / critter.stepSeconds;
          const u = Math.min(1, critter.t);
          const s = u * u * (3 - 2 * u);
          critter.root.position.lerpVectors(critter.from, critter.to, s);
          if (u < 1) continue;
          critter.moving = false;
          critter.cellX = Math.round(critter.to.x - CELL / 2);
          critter.cellZ = Math.round(critter.to.z - CELL / 2);
          setWalk(critter, false);
          critter.wait = 1.6 + Math.random() * 4.5;
          continue;
        }
        critter.wait -= dt;
        if (critter.wait > 0) continue;
        const dest = DIRS[Math.floor(Math.random() * DIRS.length)]!;
        const nx = critter.cellX + dest[0];
        const nz = critter.cellZ + dest[1];
        const ok = critter.aquatic ? waterOk(nx, nz) : landOk(nx, nz);
        if (!ok) {
          critter.wait = 0.6 + Math.random() * 1.4;
          continue;
        }
        critter.from.copy(critter.root.position);
        const y = critter.root.position.y;
        critter.to.set(nx * CELL + CELL / 2, y, nz * CELL + CELL / 2);
        if (critter.aquatic) {
          critter.root.rotation.y = Math.atan2(
            critter.to.x - critter.root.position.x,
            critter.to.z - critter.root.position.z,
          );
        } else {
          critter.root.lookAt(critter.to.x, y, critter.to.z);
        }
        critter.t = 0;
        critter.moving = true;
        setWalk(critter, true);
      }
    },
  };
}
