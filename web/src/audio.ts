import * as THREE from "three";
import { CELL } from "./constants";
import type { CoastField } from "./island";
import { cellIndex } from "./island";
import { SOUND_URLS } from "./models";
import type { GridPlayer } from "./player";

const LANDMARK_HEAR = 20 * CELL;
const OCEAN_HEAR = 42 * CELL;
const REF_DISTANCE = 3 * CELL;

function makeWaveBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 1.1;
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(rate * seconds), rate);
  const data = buffer.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    const white = Math.random() * 2 - 1;
    prev = prev * 0.92 + white * 0.08;
    const swell = Math.sin(t * Math.PI);
    data[i] = prev * swell * 0.55;
  }
  return buffer;
}

function makePondBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 0.45;
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(rate * seconds), rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    const drip = Math.sin(t * Math.PI * 18) * Math.exp(-t * 4.2);
    const fizz = (Math.random() * 2 - 1) * 0.04 * (1 - t);
    data[i] = drip * 0.12 + fizz;
  }
  return buffer;
}

async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  const raw = await res.arrayBuffer();
  return ctx.decodeAudioData(raw.slice(0));
}

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

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
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

export function setupIslandAudio(
  scene: THREE.Scene,
  player: GridPlayer,
  anchors: { id: string; position: THREE.Vector3 }[],
  coast: CoastField,
): { update: () => void } {
  const listener = new THREE.AudioListener();
  player.mesh.add(listener);

  let oceanSound: THREE.PositionalAudio | null = null;

  const hint = document.getElementById("hint");
  const unlock = async () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    await listener.context.resume();

    const ctx = listener.context as AudioContext;
    const [creaks, cloths, chops] = await Promise.all([
      Promise.all(SOUND_URLS.creaks.map((u) => loadBuffer(ctx, u))),
      Promise.all(SOUND_URLS.cloths.map((u) => loadBuffer(ctx, u))),
      Promise.all(SOUND_URLS.chops.map((u) => loadBuffer(ctx, u))),
    ]);
    const waves = [makeWaveBuffer(ctx), makeWaveBuffer(ctx), makeWaveBuffer(ctx)];
    const still = [makePondBuffer(ctx), makePondBuffer(ctx), makePondBuffer(ctx)];

    const group = new THREE.Group();
    group.name = "audio";

    oceanSound = attachRandomOneShots(listener, waves, new THREE.Vector3(), 0.48, [0.7, 2.2], OCEAN_HEAR);
    group.add(oceanSound);

    for (const a of anchors) {
      if (a.id === "wreck") {
        group.add(attachRandomOneShots(listener, creaks, a.position, 0.55, [2.5, 8], LANDMARK_HEAR));
      } else if (a.id === "hut") {
        group.add(attachRandomOneShots(listener, cloths, a.position, 0.42, [3.5, 11], LANDMARK_HEAR));
      } else if (a.id === "boat") {
        group.add(attachRandomOneShots(listener, chops, a.position, 0.32, [4, 12], LANDMARK_HEAR));
      } else if (a.id === "pond") {
        group.add(attachRandomOneShots(listener, still, a.position, 0.38, [1.1, 3.2], LANDMARK_HEAR));
      }
    }

    scene.add(group);

    if (hint) {
      hint.textContent =
        "WASD walk. + / − zoom. Ocean follows the nearest beach; pond is still water.";
    }
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  return {
    update: () => {
      if (!oceanSound) return;
      const i = cellIndex(player.cellX, player.cellZ);
      oceanSound.position.set(coast.nearX[i]! * CELL + CELL / 2, 0.8, coast.nearZ[i]! * CELL + CELL / 2);
    },
  };
}
