import * as THREE from "three";
import { SOUND_URLS } from "./models";

function makeNoiseBuffer(ctx: AudioContext, seconds: number, lowpass = false): AudioBuffer {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(rate * seconds), rate);
  const data = buffer.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    prev = lowpass ? prev * 0.86 + white * 0.14 : white * 0.35;
    const env = 0.65 + 0.35 * Math.sin((i / data.length) * Math.PI * 2);
    data[i] = prev * env * (lowpass ? 0.55 : 0.22);
  }
  return buffer;
}

async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  const raw = await res.arrayBuffer();
  return ctx.decodeAudioData(raw.slice(0));
}

function attachLoop(
  listener: THREE.AudioListener,
  buffer: AudioBuffer,
  position: THREE.Vector3,
  refDistance: number,
  volume: number,
): THREE.PositionalAudio {
  const sound = new THREE.PositionalAudio(listener);
  sound.setBuffer(buffer);
  sound.setLoop(true);
  sound.setRefDistance(refDistance);
  sound.setMaxDistance(refDistance * 4.2);
  sound.setVolume(volume);
  sound.position.copy(position);
  return sound;
}

export function setupIslandAudio(
  scene: THREE.Scene,
  camera: THREE.Camera,
  anchors: { id: string; position: THREE.Vector3 }[],
): void {
  const listener = new THREE.AudioListener();
  camera.add(listener);

  const hint = document.getElementById("hint");
  const unlock = async () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    await listener.context.resume();

    const ctx = listener.context as AudioContext;
    const [creak, cloth, chop] = await Promise.all([
      loadBuffer(ctx, SOUND_URLS.creak),
      loadBuffer(ctx, SOUND_URLS.cloth),
      loadBuffer(ctx, SOUND_URLS.chop),
    ]);
    const surf = makeNoiseBuffer(ctx, 3.2, true);
    const pond = makeNoiseBuffer(ctx, 2.4, true);

    const group = new THREE.Group();
    group.name = "audio";

    for (const a of anchors) {
      let clip: AudioBuffer | null = null;
      let ref = 10;
      let vol = 0.45;
      if (a.id === "wreck") {
        clip = creak;
        ref = 12;
        vol = 0.5;
      } else if (a.id === "hut") {
        clip = cloth;
        ref = 9;
        vol = 0.4;
      } else if (a.id === "boat") {
        clip = chop;
        ref = 8;
        vol = 0.28;
      } else if (a.id === "pond") {
        clip = pond;
        ref = 11;
        vol = 0.35;
      } else if (a.id === "surf") {
        clip = surf;
        ref = 18;
        vol = 0.32;
      }
      if (!clip) continue;
      group.add(attachLoop(listener, clip, a.position, ref, vol));
    }

    scene.add(group);
    group.traverse((obj) => {
      if (obj instanceof THREE.PositionalAudio) obj.play();
    });

    if (hint) {
      hint.textContent =
        "WASD / arrows — walk. Landmarks: wreck, hut, pond, fishing boat. Sounds fade with distance.";
    }
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}
