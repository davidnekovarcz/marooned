import * as THREE from "three";
import { CELL, SOUND_3D } from "@/web/src/constants";
import type { CoastField } from "@/web/src/island";
import { cellIndex } from "@/web/src/island";
import { SOUND_URLS } from "@/web/src/models";
import type { GridPlayer } from "@/web/src/player";

const LANDMARK_HEAR = 20 * CELL;
const OCEAN_HEAR = 42 * CELL;
const REF_DISTANCE = 3 * CELL;

function makeWaveBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 4;
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(rate * seconds), rate);
  const data = buffer.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    const white = Math.random() * 2 - 1;
    prev = prev * 0.88 + white * 0.12;
    const swell = 0.55 + 0.28 * Math.sin(t * Math.PI * 2) + 0.17 * Math.sin(t * Math.PI * 2 * 1.6 + 0.9);
    const fade = Math.min(t * 18, (1 - t) * 18, 1);
    data[i] = prev * swell * fade * 0.5;
  }
  return buffer;
}

/** Dirt/shovel strike — was pond splash; keep for dig interact later (not ambient). */
export function makeShovelBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 0.45;
  const rate = ctx.sampleRate;
  const n = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(1, n, rate);
  const data = buffer.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const u = t / seconds;
    const white = Math.random() * 2 - 1;
    prev = prev * 0.72 + white * 0.28;
    const env = Math.exp(-u * 7) * Math.sin(Math.min(1, u * 18) * Math.PI * 0.5);
    data[i] = prev * env * 0.4;
  }
  return buffer;
}

async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  const raw = await res.arrayBuffer();
  return ctx.decodeAudioData(raw.slice(0));
}

const _listenerPos = new THREE.Vector3();
const _listenerQuat = new THREE.Quaternion();
const _ahead = new THREE.Vector3();

function spatialize(
  sound: THREE.PositionalAudio,
  position: THREE.Vector3,
  volume: number,
  maxDistance: number,
): void {
  sound.setDistanceModel("linear");
  sound.setRefDistance(REF_DISTANCE);
  sound.setMaxDistance(maxDistance);
  sound.setRolloffFactor(1);
  sound.setVolume(volume);
  sound.position.copy(position);
}

/** Keep distance attenuation; with SOUND_3D off, pin the source in front so it never pans L/R. */
function applySpatial(
  sound: THREE.PositionalAudio,
  source: THREE.Vector3,
  listener: THREE.AudioListener,
): void {
  if (SOUND_3D) {
    sound.position.copy(source);
    return;
  }
  listener.getWorldPosition(_listenerPos);
  listener.getWorldQuaternion(_listenerQuat);
  const dist = _listenerPos.distanceTo(source);
  _ahead.set(0, 0, -1).applyQuaternion(_listenerQuat).multiplyScalar(dist);
  sound.position.copy(_listenerPos).add(_ahead);
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function attachLoop(
  listener: THREE.AudioListener,
  buffer: AudioBuffer,
  position: THREE.Vector3,
  volume: number,
  maxDistance: number,
): THREE.PositionalAudio {
  const sound = new THREE.PositionalAudio(listener);
  sound.setBuffer(buffer);
  sound.setLoop(true);
  spatialize(sound, position, volume, maxDistance);
  return sound;
}

function attachRandomOneShots(
  listener: THREE.AudioListener,
  buffers: AudioBuffer[],
  position: THREE.Vector3,
  volume: number,
  gapSec: [number, number],
  maxDistance: number,
): THREE.PositionalAudio {
  const sound = new THREE.PositionalAudio(listener);
  spatialize(sound, position, volume, maxDistance);

  const playLater = (delayMs: number) => {
    window.setTimeout(() => {
      const buf = pick(buffers);
      if (sound.isPlaying) sound.stop();
      sound.setBuffer(buf);
      sound.play();
      playLater((buf.duration + randRange(gapSec[0], gapSec[1])) * 1000);
    }, delayMs);
  };

  playLater(randRange(0.2, gapSec[1]) * 1000);
  return sound;
}

export type MealKind = "drink" | "eat";

export function setupIslandAudio(
  scene: THREE.Scene,
  player: GridPlayer,
  anchors: { id: string; position: THREE.Vector3 }[],
  coast: CoastField,
): { update: () => void; playMeal: (kind: MealKind) => void; stopMeal: () => void; playPickup: () => void } {
  const listener = new THREE.AudioListener();
  player.mesh.add(listener);

  let oceanSound: THREE.PositionalAudio | null = null;
  const oceanSource = new THREE.Vector3();
  const tracked: { sound: THREE.PositionalAudio; source: THREE.Vector3 }[] = [];
  const mealSound = new THREE.Audio(listener);
  const rustleSound = new THREE.Audio(listener);
  let eatBufs: AudioBuffer[] = [];
  let rustleBuf: AudioBuffer | null = null;
  let mealActive = false;
  let eatIndex = 0;
  let mealTimer = 0;
  let pendingMeal = false;

  const playNextEatClip = () => {
    if (!mealActive || eatBufs.length === 0) return;
    const buf = eatBufs[eatIndex % eatBufs.length]!;
    eatIndex += 1;
    if (mealSound.isPlaying) mealSound.stop();
    mealSound.setBuffer(buf);
    mealSound.setVolume(0.62);
    mealSound.play();
    window.clearTimeout(mealTimer);
    mealTimer = window.setTimeout(() => {
      if (mealActive) playNextEatClip();
    }, Math.max(50, buf.duration * 1000));
  };

  const startMeal = () => {
    if (eatBufs.length === 0) {
      pendingMeal = true;
      return;
    }
    pendingMeal = false;
    mealActive = true;
    eatIndex = 0;
    playNextEatClip();
  };

  const hint = document.getElementById("hint");
  const unlock = async () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    await listener.context.resume();

    const ctx = listener.context as AudioContext;
    const [creaks, cloths, chops, eats] = await Promise.all([
      Promise.all(SOUND_URLS.creaks.map((u) => loadBuffer(ctx, u))),
      Promise.all(SOUND_URLS.cloths.map((u) => loadBuffer(ctx, u))),
      Promise.all(SOUND_URLS.chops.map((u) => loadBuffer(ctx, u))),
      Promise.all(SOUND_URLS.eats.map((u) => loadBuffer(ctx, u))),
    ]);
    const waves = makeWaveBuffer(ctx);
    eatBufs = eats;
    rustleBuf = cloths[0] ?? null;

    const group = new THREE.Group();
    group.name = "audio";

    const track = (sound: THREE.PositionalAudio, source: THREE.Vector3) => {
      group.add(sound);
      tracked.push({ sound, source });
    };

    oceanSound = attachLoop(listener, waves, oceanSource, 0.5, OCEAN_HEAR);
    track(oceanSound, oceanSource);
    oceanSound.play();

    for (const a of anchors) {
      const source = a.position.clone();
      if (a.id === "wreck") {
        track(attachRandomOneShots(listener, creaks, source, 0.55, [2.5, 8], LANDMARK_HEAR), source);
      } else if (a.id === "hut" || a.id === "boat") {
        track(attachRandomOneShots(listener, chops, source, 0.32, [4, 12], LANDMARK_HEAR), source);
      }
    }

    scene.add(group);

    if (pendingMeal) startMeal();

    if (hint) {
      hint.textContent = "+ / − zoom. WASD walk. SHIFT run.";
    }
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  return {
    update: () => {
      if (!oceanSound) return;
      const i = cellIndex(player.cellX, player.cellZ);
      oceanSource.set(coast.nearX[i]! * CELL + CELL / 2, 0.8, coast.nearZ[i]! * CELL + CELL / 2);
      for (const item of tracked) applySpatial(item.sound, item.source, listener);
    },
    playMeal: (_kind) => {
      // Same loaded eat_01 / eat_04 clips for every fruit (incl. coconut half).
      void _kind;
      startMeal();
    },
    /** Cut chew when the meal lock ends so silence and movement return together. */
    stopMeal: () => {
      mealActive = false;
      pendingMeal = false;
      window.clearTimeout(mealTimer);
      if (mealSound.isPlaying) mealSound.stop();
    },
    playPickup: () => {
      if (!rustleBuf) return;
      if (rustleSound.isPlaying) rustleSound.stop();
      rustleSound.setBuffer(rustleBuf);
      rustleSound.setVolume(0.4);
      rustleSound.play();
    },
  };
}
