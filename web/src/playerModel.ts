import * as THREE from "three";
import type { Appearance } from "./appearance";
import { GROUND_Y } from "./constants";
import { loadFbx } from "./loaders";
import { PLAYER_URLS } from "./models";

const TARGET_HEIGHT = 1.6;
const RUN_TIME_SCALE = 0.55;
const FADE = 0.14;
const HELPER_BONE = /Ctrl|IK|Roll|_end$/;
const FOOT_BONES = ["LeftFoot", "RightFoot", "LeftToes", "RightToes"] as const;

export type PlayerVisual = {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  setMoving: (on: boolean) => void;
};

const _foot = new THREE.Vector3();

function skinUrl(appearance: Appearance): string {
  return appearance.gender === "female" ? PLAYER_URLS.female : PLAYER_URLS.male;
}

function skinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) found = mesh;
  });
  if (!found) throw new Error("Kenney character has no SkinnedMesh");
  return found;
}

function applySkin(root: THREE.Object3D, map: THREE.Texture): void {
  map.colorSpace = THREE.SRGBColorSpace;
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.material = new THREE.MeshStandardMaterial({
      map,
      metalness: 0,
      roughness: 0.82,
    });
  });
}

function hideIkBones(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const bone = obj as THREE.Bone;
    if (bone.isBone && HELPER_BONE.test(bone.name)) bone.visible = false;
  });
}

/** Bind-pose mesh bbox is OK for height; it does not match posed foot height. */
function scaleToHeight(model: THREE.Object3D): void {
  const body = skinnedMesh(model);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(body);
  const size = box.getSize(new THREE.Vector3());
  const s = TARGET_HEIGHT / Math.max(size.y, 0.001);
  model.scale.multiplyScalar(s);
}

/** After idle pose is applied, lower the model so foot bones sit on GROUND_Y. */
function plantFeet(model: THREE.Object3D): void {
  model.updateMatrixWorld(true);
  let minY = Infinity;
  for (const name of FOOT_BONES) {
    const bone = model.getObjectByName(name);
    if (!bone) continue;
    bone.getWorldPosition(_foot);
    minY = Math.min(minY, _foot.y);
  }
  if (minY === Infinity) return;
  model.position.y += GROUND_Y - minY;
}

function pickClip(fbx: THREE.Group, kind: "Idle" | "Run"): THREE.AnimationClip {
  const prefer = kind === "Idle" ? /Idle/i : /Run/i;
  const clip =
    fbx.animations.find((a) => prefer.test(a.name) && !/Targeting/i.test(a.name)) ??
    fbx.animations.find((a) => prefer.test(a.name)) ??
    fbx.animations.find((a) => !/Targeting/i.test(a.name));
  if (!clip) throw new Error(`Kenney animation FBX has no ${kind} clip`);
  const copy = clip.clone();
  copy.name = kind;
  return copy;
}

function boneNames(root: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) names.add(obj.name);
  });
  return names;
}

/** Kenney idle/run FBXs use the same bones as the mesh, but track prefixes often differ. */
function bindClipTracks(root: THREE.Object3D, clip: THREE.AnimationClip): void {
  const bones = boneNames(root);
  for (const track of clip.tracks) {
    const [node, ...rest] = track.name.split(".");
    if (!node || rest.length === 0) continue;
    if (bones.has(node)) continue;
    const short = node.split("|").pop() ?? node;
    if (bones.has(short)) {
      track.name = [short, ...rest].join(".");
    }
  }
}

/** Rotations only — position tracks are cm-scale root motion and lift the body off the grid. */
function makeInPlace(clip: THREE.AnimationClip): void {
  clip.tracks = clip.tracks.filter((track) => {
    const [node, prop] = track.name.split(".");
    if (!node || prop !== "quaternion") return false;
    return !HELPER_BONE.test(node);
  });
}

export async function loadPlayerModel(appearance: Appearance): Promise<PlayerVisual> {
  const [model, idleFbx, runFbx, map] = await Promise.all([
    loadFbx(PLAYER_URLS.model),
    loadFbx(PLAYER_URLS.idle),
    loadFbx(PLAYER_URLS.run),
    new THREE.TextureLoader().loadAsync(skinUrl(appearance)),
  ]);

  applySkin(model, map);
  hideIkBones(model);
  scaleToHeight(model);
  // TODO: tint atlas peaches → appearance.skin and greys → appearance.clothes

  const root = new THREE.Group();
  root.name = "player";
  root.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const idleClip = pickClip(idleFbx, "Idle");
  const runClip = pickClip(runFbx, "Run");
  bindClipTracks(model, idleClip);
  bindClipTracks(model, runClip);
  makeInPlace(idleClip);
  makeInPlace(runClip);

  const idle = mixer.clipAction(idleClip);
  const run = mixer.clipAction(runClip);
  idle.setLoop(THREE.LoopRepeat, Infinity);
  run.setLoop(THREE.LoopRepeat, Infinity);
  idle.play();
  mixer.update(0);
  plantFeet(model);

  run.timeScale = RUN_TIME_SCALE;
  run.enabled = false;

  let moving = false;
  const setMoving = (on: boolean) => {
    if (on === moving) return;
    moving = on;
    if (on) {
      run.enabled = true;
      run.reset().setEffectiveWeight(1).fadeIn(FADE).play();
      idle.fadeOut(FADE);
    } else {
      idle.reset().setEffectiveWeight(1).fadeIn(FADE).play();
      run.fadeOut(FADE);
    }
  };

  return { root, mixer, setMoving };
}
