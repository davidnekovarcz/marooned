import * as THREE from "three";
import { CELL, SOUND_3D } from "@/web/src/constants";
import type { CoastField } from "@/web/src/island";
import { cellIndex } from "@/web/src/island";
import { SOUND_URLS } from "@/web/src/models";
import type { GridPlayer } from "@/web/src/actor/player";
import type { Camp } from "@/web/src/sim/camp";

const LANDMARK_HEAR = 20 * CELL;
const OCEAN_HEAR = 42 * CELL;
const REF_DISTANCE = 3 * CELL;

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

function playOne(sound: THREE.Audio, buf: AudioBuffer | null, volume: number): void {
  if (!buf) return;
  if (sound.isPlaying) sound.stop();
  sound.setBuffer(buf);
  sound.setVolume(volume);
  sound.play();
}

export type MealKind = "drink" | "eat";

export type IslandAudio = {
  update: (rain: number, sheltered: boolean, quiet?: boolean) => void;
  playMeal: (kind: MealKind) => void;
  stopMeal: () => void;
  playPickup: () => void;
  playSplash: () => void;
  playDrink: () => void;
  playCut: () => void;
  playBuild: () => void;
  playLight: () => void;
  playCook: () => void;
};

export function setupIslandAudio(
  scene: THREE.Scene,
  player: GridPlayer,
  anchors: { id: string; position: THREE.Vector3 }[],
  coast: CoastField,
  camp: Camp,
  onUnlocked?: () => void,
): IslandAudio {
  const listener = new THREE.AudioListener();
  player.mesh.add(listener);

  let oceanSound: THREE.PositionalAudio | null = null;
  const oceanSource = new THREE.Vector3();
  const tracked: { sound: THREE.PositionalAudio; source: THREE.Vector3 }[] = [];
  const mealSound = new THREE.Audio(listener);
  const rustleSound = new THREE.Audio(listener);
  const oneShot = new THREE.Audio(listener);
  const rainSound = new THREE.Audio(listener);
  const rainSoftSound = new THREE.Audio(listener);
  const fireSounds: THREE.PositionalAudio[] = [];
  let eatBufs: AudioBuffer[] = [];
  let drinkBufs: AudioBuffer[] = [];
  let sliceBufs: AudioBuffer[] = [];
  let rustleBuf: AudioBuffer | null = null;
  let splashBufs: AudioBuffer[] = [];
  let chopBuf: AudioBuffer | null = null;
  let plankBuf: AudioBuffer | null = null;
  let potBuf: AudioBuffer | null = null;
  let clothBuf: AudioBuffer | null = null;
  let rainReady = false;
  let mealActive = false;
  let mealKind: MealKind = "eat";
  let eatIndex = 0;
  let mealTimer = 0;
  let pendingMeal = false;
  let cutTimer = 0;

  const mealBufs = (): AudioBuffer[] => (mealKind === "drink" ? drinkBufs : eatBufs);

  const playNextMealClip = () => {
    const bufs = mealBufs();
    if (!mealActive || bufs.length === 0) return;
    const buf = bufs[eatIndex % bufs.length]!;
    eatIndex += 1;
    if (mealSound.isPlaying) mealSound.stop();
    mealSound.setBuffer(buf);
    mealSound.setVolume(mealKind === "drink" ? 0.8 : 0.62);
    mealSound.play();
    window.clearTimeout(mealTimer);
    mealTimer = window.setTimeout(() => {
      if (mealActive) playNextMealClip();
    }, Math.max(50, buf.duration * 1000));
  };

  const startMeal = (kind: MealKind) => {
    mealKind = kind;
    if (mealBufs().length === 0) {
      pendingMeal = true;
      return;
    }
    pendingMeal = false;
    mealActive = true;
    eatIndex = 0;
    playNextMealClip();
  };

  const unlock = async () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    await listener.context.resume();

    const ctx = listener.context as AudioContext;
    const [creaks, cloths, chops, eats, waves, splashes, drinks, slices, river, rain, rainSoft, fire, crackle, plank, pot] =
      await Promise.all([
        Promise.all(SOUND_URLS.creaks.map((u) => loadBuffer(ctx, u))),
        Promise.all(SOUND_URLS.cloths.map((u) => loadBuffer(ctx, u))),
        Promise.all(SOUND_URLS.chops.map((u) => loadBuffer(ctx, u))),
        Promise.all(SOUND_URLS.eats.map((u) => loadBuffer(ctx, u))),
        Promise.all(SOUND_URLS.waves.map((u) => loadBuffer(ctx, u))),
        Promise.all(SOUND_URLS.splashes.map((u) => loadBuffer(ctx, u))),
        Promise.all(SOUND_URLS.drinks.map((u) => loadBuffer(ctx, u))),
        Promise.all(SOUND_URLS.slices.map((u) => loadBuffer(ctx, u))),
        loadBuffer(ctx, SOUND_URLS.river),
        loadBuffer(ctx, SOUND_URLS.rain),
        loadBuffer(ctx, SOUND_URLS.rainSoft),
        loadBuffer(ctx, SOUND_URLS.fire),
        loadBuffer(ctx, SOUND_URLS.crackle),
        loadBuffer(ctx, SOUND_URLS.plank),
        loadBuffer(ctx, SOUND_URLS.pot),
      ]);
    eatBufs = eats;
    drinkBufs = drinks;
    sliceBufs = slices;
    rustleBuf = cloths[0] ?? null;
    clothBuf = cloths[1] ?? cloths[0] ?? null;
    splashBufs = splashes;
    chopBuf = chops[0] ?? null;
    plankBuf = plank;
    potBuf = pot;

    const group = new THREE.Group();
    group.name = "audio";

    const track = (sound: THREE.PositionalAudio, source: THREE.Vector3) => {
      group.add(sound);
      tracked.push({ sound, source });
    };

    const swell = waves[0] ?? waves[1];
    if (swell) {
      oceanSound = attachLoop(listener, swell, oceanSource, 0.48, OCEAN_HEAR);
      track(oceanSound, oceanSource);
      oceanSound.play();
    }
    if (waves.length > 1) {
      track(attachRandomOneShots(listener, waves.slice(1), oceanSource, 0.38, [3, 9], OCEAN_HEAR), oceanSource);
    }

    rainSound.setBuffer(rain);
    rainSound.setLoop(true);
    rainSound.setVolume(0);
    rainSoftSound.setBuffer(rainSoft);
    rainSoftSound.setLoop(true);
    rainSoftSound.setVolume(0);
    rainReady = true;

    for (const a of anchors) {
      const source = a.position.clone();
      if (a.id === "wreck") {
        track(attachRandomOneShots(listener, creaks, source, 0.55, [2.5, 8], LANDMARK_HEAR), source);
      } else if (a.id === "hut" || a.id === "boat") {
        track(attachRandomOneShots(listener, chops, source, 0.32, [4, 12], LANDMARK_HEAR), source);
      } else if (a.id === "pond") {
        const riverSound = attachLoop(listener, river, source, 0.4, 22 * CELL);
        track(riverSound, source);
        riverSound.play();
      }
    }

    for (let i = 0; i < 4; i++) {
      const fireSound = new THREE.PositionalAudio(listener);
      fireSound.setBuffer(i === 0 ? fire : crackle);
      fireSound.setLoop(true);
      spatialize(fireSound, new THREE.Vector3(), 0, 16 * CELL);
      group.add(fireSound);
      fireSounds.push(fireSound);
    }

    scene.add(group);
    if (pendingMeal) startMeal(mealKind);
    onUnlocked?.();
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  return {
    update: (rainAmt: number, sheltered: boolean, quiet = false) => {
      const ctx = listener.context;
      if (quiet) {
        if (ctx.state === "running") void ctx.suspend();
        return;
      }
      if (rainReady && ctx.state === "suspended") void ctx.resume();

      if (oceanSound) {
        const i = cellIndex(player.cellX, player.cellZ);
        oceanSource.set(coast.nearX[i]! * CELL + CELL / 2, 0.8, coast.nearZ[i]! * CELL + CELL / 2);
      }
      for (const item of tracked) applySpatial(item.sound, item.source, listener);

      if (rainReady) {
        const wetVol = rainAmt * (sheltered ? 0.22 : 0.7);
        const softVol = rainAmt * (sheltered ? 0.12 : 0.28);
        if (rainAmt > 0.04) {
          if (!rainSound.isPlaying) rainSound.play();
          if (!rainSoftSound.isPlaying) rainSoftSound.play();
        }
        rainSound.setVolume(wetVol);
        rainSoftSound.setVolume(softVol);
        if (oceanSound) oceanSound.setVolume(0.48 + rainAmt * 0.22);
      }

      const lit = camp.hearths.filter((h) => h.lit);
      for (let i = 0; i < fireSounds.length; i++) {
        const sound = fireSounds[i]!;
        const hearth = lit[i];
        if (!hearth) {
          if (sound.isPlaying) sound.stop();
          continue;
        }
        applySpatial(sound, camp.worldPos(hearth), listener);
        sound.setVolume(0.55);
        if (!sound.isPlaying) sound.play();
      }
    },
    playMeal: (kind) => startMeal(kind),
    stopMeal: () => {
      mealActive = false;
      pendingMeal = false;
      window.clearTimeout(mealTimer);
      if (mealSound.isPlaying) mealSound.stop();
    },
    playPickup: () => playOne(rustleSound, rustleBuf, 0.4),
    playSplash: () => playOne(oneShot, pick(splashBufs) ?? null, 0.55),
    playDrink: () => startMeal("drink"),
    playCut: () => {
      const first = pick(sliceBufs) ?? null;
      playOne(oneShot, first, 0.7);
      window.clearTimeout(cutTimer);
      cutTimer = window.setTimeout(() => {
        playOne(oneShot, pick(sliceBufs) ?? first, 0.62);
      }, 850);
    },
    playBuild: () => playOne(oneShot, plankBuf ?? chopBuf, 0.62),
    playLight: () => playOne(oneShot, clothBuf, 0.5),
    playCook: () => playOne(oneShot, potBuf, 0.55),
  };
}
