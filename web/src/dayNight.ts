import * as THREE from "three";
import { CENTER, DAY_SECONDS, DAY_START } from "@/web/src/constants";

const SKY_NOON = new THREE.Color(0xb5e8f6);
const SKY_DAWN = new THREE.Color(0xf4b878);
const SKY_DUSK = new THREE.Color(0xc45a3a);
const SKY_NIGHT = new THREE.Color(0x040914);

const HEMI_SKY_NOON = new THREE.Color(0xfff8e8);
const HEMI_SKY_DUSK = new THREE.Color(0xff9a62);
const HEMI_SKY_NIGHT = new THREE.Color(0x0d1528);
const HEMI_GROUND_NOON = new THREE.Color(0x4a8044);
const HEMI_GROUND_NIGHT = new THREE.Color(0x05080c);

const _sky = new THREE.Color();
const _hemiSky = new THREE.Color();
const _hemiGround = new THREE.Color();

/** Personal or world seconds → island hours (24h cycle = DAY_SECONDS real). */
export function livedHoursFromSeconds(seconds: number): number {
  return (Math.max(0, seconds) / DAY_SECONDS) * 24;
}

export class DayClock {
  /** 0 midnight … 0.25 dawn … 0.5 noon … 0.75 dusk. */
  t = DAY_START;
  /** Real seconds since spawn (does not wrap). */
  elapsed = 0;

  update(dt: number): void {
    this.elapsed += dt;
    this.t = (this.t + dt / DAY_SECONDS) % 1;
  }

  /** Island hours from world elapsed (24h cycle = DAY_SECONDS real). */
  survivedGameHours(): number {
    return livedHoursFromSeconds(this.elapsed);
  }

  clockLabel(): string {
    const minutes = Math.floor(this.t * 24 * 60) % (24 * 60);
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
}

export type DayLights = {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  moon: THREE.DirectionalLight;
};

function configureShadowCam(light: THREE.DirectionalLight): void {
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 280;
  light.shadow.camera.left = -100;
  light.shadow.camera.right = 100;
  light.shadow.camera.top = 100;
  light.shadow.camera.bottom = -100;
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.bias = -0.0001;
  light.shadow.normalBias = 0.02;
}

export function createDayLights(scene: THREE.Scene): DayLights {
  const hemi = new THREE.HemisphereLight(0xfff8e8, 0x4a8044, 1.15);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff6e0, 1.85);
  sun.target.position.set(CENTER, 0, CENTER);
  sun.castShadow = true;
  configureShadowCam(sun);
  scene.add(sun);
  scene.add(sun.target);

  const moon = new THREE.DirectionalLight(0xc5d4f0, 0);
  moon.target.position.set(CENTER, 0, CENTER);
  moon.castShadow = false;
  configureShadowCam(moon);
  scene.add(moon);
  scene.add(moon.target);

  return { hemi, sun, moon };
}

/** elevation: 1 noon, 0 horizon, −1 midnight. */
export function sunElevation(t: number): number {
  return Math.sin((t - 0.25) * Math.PI * 2);
}

export function isDaytime(t: number): boolean {
  return sunElevation(t) > 0;
}

function mixSky(t: number, out: THREE.Color): THREE.Color {
  const elev = sunElevation(t);
  if (elev > 0.15) {
    const u = THREE.MathUtils.clamp((elev - 0.15) / 0.85, 0, 1);
    return out.copy(SKY_DAWN).lerp(SKY_NOON, u);
  }
  if (elev > 0) {
    const dusk = t > 0.5 ? SKY_DUSK : SKY_DAWN;
    const u = elev / 0.15;
    return out.copy(SKY_NIGHT).lerp(dusk, u);
  }
  const u = THREE.MathUtils.clamp((-elev) / 0.35, 0, 1);
  const dusk = t > 0.5 ? SKY_DUSK : SKY_DAWN;
  return out.copy(dusk).lerp(SKY_NIGHT, u);
}

export function applyDayNight(
  scene: THREE.Scene,
  lights: DayLights,
  t: number,
  rain = 0,
  flash = 0,
): void {
  const elev = sunElevation(t);
  const angle = (t - 0.25) * Math.PI * 2;
  const orbit = 70;
  const height = 62;

  lights.sun.position.set(
    CENTER + Math.cos(angle) * orbit,
    Math.sin(angle) * height,
    CENTER + Math.sin(angle) * 24,
  );
  lights.moon.position.set(
    CENTER - Math.cos(angle) * orbit,
    -Math.sin(angle) * height,
    CENTER - Math.sin(angle) * 24,
  );

  const sunUp = elev > 0.04;
  const moonUp = elev < -0.04;
  const rainDim = 1 - rain * 0.72;
  lights.sun.intensity = sunUp ? (0.45 + elev * 1.55) * rainDim : 0;
  lights.sun.castShadow = sunUp;
  lights.moon.intensity = moonUp ? 0.03 + Math.min(1, -elev) * 0.06 : 0;
  lights.moon.castShadow = moonUp && !sunUp;

  const duskAmt = THREE.MathUtils.clamp(1 - Math.abs(elev) / 0.35, 0, 1);
  mixSky(t, _sky);
  if (rain > 0.02) {
    const storm = new THREE.Color(0x4a5c6e);
    _sky.lerp(storm, THREE.MathUtils.clamp(rain * 0.85, 0, 0.85));
  }
  if (flash > 0.02) {
    _sky.lerp(new THREE.Color(0xe8f0ff), flash);
  }
  scene.background = _sky;
  if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(_sky);

  const night = THREE.MathUtils.clamp(-elev, 0, 1);
  _hemiSky.copy(HEMI_SKY_NOON).lerp(HEMI_SKY_DUSK, duskAmt * (1 - night)).lerp(HEMI_SKY_NIGHT, night);
  _hemiGround.copy(HEMI_GROUND_NOON).lerp(HEMI_GROUND_NIGHT, night);
  lights.hemi.color.copy(_hemiSky);
  lights.hemi.groundColor.copy(_hemiGround);
  const hemiNight = THREE.MathUtils.lerp(1.15, 0.018, night);
  lights.hemi.intensity = hemiNight * (1 - rain * 0.35) + flash * 2.4;
}
