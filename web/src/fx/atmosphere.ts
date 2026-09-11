import * as THREE from "three";
import { CELL, GROUND_Y } from "@/web/src/constants";
import type { Camp, Hearth } from "@/web/src/sim/camp";

const RAIN_COUNT = 1600;
const FIRE_COUNT = 70;
const STEAM_COUNT = 48;
const FLY_COUNT = 28;

function makeCircleTexture(color: string, size = 32): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, color);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function makeStreakTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 32;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(4, 0, 4, 32);
  grd.addColorStop(0, "rgba(220,235,255,0)");
  grd.addColorStop(0.35, "rgba(210,228,255,0.95)");
  grd.addColorStop(1, "rgba(170,200,230,0)");
  g.fillStyle = grd;
  g.fillRect(2, 0, 4, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

type Cloud = {
  geo: THREE.BufferGeometry;
  pos: Float32Array;
  extra: Float32Array;
  points: THREE.Points;
};

function cloud(
  count: number,
  material: THREE.PointsMaterial,
  extraStride: number,
): Cloud {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const extra = new Float32Array(count * extraStride);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 6;
  return { geo, pos, extra, points };
}

export class Atmosphere {
  private readonly group = new THREE.Group();
  private readonly rain: Cloud;
  private readonly fire: Cloud;
  private readonly steam: Cloud;
  private readonly flies: Cloud;
  private readonly torchLight: THREE.PointLight;
  private readonly fireLights: THREE.PointLight[] = [];
  private readonly rainTex: THREE.CanvasTexture;
  private readonly fireTex: THREE.CanvasTexture;
  private readonly steamTex: THREE.CanvasTexture;
  private readonly flyTex: THREE.CanvasTexture;
  private rainAmt = 0;
  private steamOn = false;
  private fliesOn = false;
  private wet = 0;
  private island: THREE.MeshLambertMaterial | null = null;
  private hearths: Hearth[] = [];
  private camp: Camp | null = null;

  constructor(
    private scene: THREE.Scene,
  ) {
    this.group.name = "atmosphere";
    this.rainTex = makeStreakTexture();
    this.fireTex = makeCircleTexture("rgba(255,180,60,1)", 48);
    this.steamTex = makeCircleTexture("rgba(230,240,255,0.9)", 48);
    this.flyTex = makeCircleTexture("rgba(255,230,120,1)", 32);

    this.rain = cloud(
      RAIN_COUNT,
      new THREE.PointsMaterial({
        map: this.rainTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        size: 0.55,
        opacity: 0,
        sizeAttenuation: true,
      }),
      1,
    );
    this.fire = cloud(
      FIRE_COUNT * 4,
      new THREE.PointsMaterial({
        map: this.fireTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        size: 0.28,
        opacity: 0,
        sizeAttenuation: true,
      }),
      4,
    );
    this.steam = cloud(
      STEAM_COUNT,
      new THREE.PointsMaterial({
        map: this.steamTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        size: 0.42,
        opacity: 0,
        sizeAttenuation: true,
      }),
      3,
    );
    this.flies = cloud(
      FLY_COUNT,
      new THREE.PointsMaterial({
        map: this.flyTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        size: 0.18,
        opacity: 0,
        sizeAttenuation: true,
      }),
      4,
    );

    this.torchLight = new THREE.PointLight(0xffb45a, 0, 11, 1.6);
    this.torchLight.castShadow = false;
    this.group.add(this.rain.points, this.fire.points, this.steam.points, this.flies.points, this.torchLight);
    this.scene.add(this.group);

    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xff8a3a, 0, 13, 1.4);
      light.castShadow = false;
      this.fireLights.push(light);
      this.group.add(light);
    }

    this.seedRain();
    this.seedFlies();
  }

  attachIsland(mesh: THREE.Mesh): void {
    const mat = mesh.material;
    if (mat instanceof THREE.MeshLambertMaterial) this.island = mat;
  }

  bindCamp(camp: Camp): void {
    this.camp = camp;
    this.hearths = camp.hearths;
    this.seedFire();
  }

  setRain(amount: number): void {
    this.rainAmt = amount;
  }

  setSteam(on: boolean): void {
    this.steamOn = on;
  }

  setFireflies(on: boolean): void {
    this.fliesOn = on;
  }

  setWetGround(amount: number): void {
    this.wet = amount;
  }

  update(
    dt: number,
    player: THREE.Vector3,
    torch: THREE.Vector3 | null,
    elapsed: number,
    flash: number,
  ): void {
    this.updateRain(dt, player);
    this.updateFire(dt, elapsed);
    this.updateSteam(dt, player);
    this.updateFlies(dt, player, elapsed);
    this.updateLights(torch, elapsed, flash);
    if (this.island) {
      const w = this.wet;
      this.island.color.setRGB(1 - w * 0.38, 1 - w * 0.28, 1 - w * 0.18);
    }
  }

  private seedRain(): void {
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rain.pos[i * 3] = 0;
      this.rain.pos[i * 3 + 1] = Math.random() * 16;
      this.rain.pos[i * 3 + 2] = 0;
      this.rain.extra[i] = 9 + Math.random() * 10;
    }
  }

  private seedFire(): void {
    const n = this.fire.pos.length / 3;
    for (let i = 0; i < n; i++) {
      this.fire.extra[i * 4] = Math.random();
      this.fire.extra[i * 4 + 1] = 0.55 + Math.random() * 1.1;
      this.fire.extra[i * 4 + 2] = Math.random() * Math.PI * 2;
      this.fire.extra[i * 4 + 3] = 0.12 + Math.random() * 0.22;
    }
  }

  private seedFlies(): void {
    for (let i = 0; i < FLY_COUNT; i++) {
      this.flies.extra[i * 4] = Math.random() * Math.PI * 2;
      this.flies.extra[i * 4 + 1] = 0.4 + Math.random() * 1.4;
      this.flies.extra[i * 4 + 2] = 1.5 + Math.random() * 3.5;
      this.flies.extra[i * 4 + 3] = 0.6 + Math.random() * 1.4;
    }
  }

  private updateRain(dt: number, player: THREE.Vector3): void {
    const mat = this.rain.points.material as THREE.PointsMaterial;
    mat.opacity = this.rainAmt * 0.85;
    this.rain.points.visible = this.rainAmt > 0.02;
    if (this.rainAmt < 0.02) return;
    const spread = 18;
    for (let i = 0; i < RAIN_COUNT; i++) {
      const ix = i * 3;
      this.rain.pos[ix + 1]! -= this.rain.extra[i]! * (0.7 + this.rainAmt) * dt;
      this.rain.pos[ix]! -= 1.6 * dt;
      if (this.rain.pos[ix + 1]! < GROUND_Y) {
        this.rain.pos[ix] = player.x + (Math.random() - 0.5) * spread * 2;
        this.rain.pos[ix + 1] = player.y + 9 + Math.random() * 8;
        this.rain.pos[ix + 2] = player.z + (Math.random() - 0.5) * spread * 2;
      }
    }
    (this.rain.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private updateFire(dt: number, elapsed: number): void {
    const lit = this.hearths.filter((h) => h.lit);
    const mat = this.fire.points.material as THREE.PointsMaterial;
    mat.opacity = lit.length ? 0.95 : 0;
    this.fire.points.visible = lit.length > 0;
    if (!lit.length) return;
    const per = FIRE_COUNT;
    for (let h = 0; h < 4; h++) {
      const hearth = lit[h];
      const origin = hearth ? hearth.item.mesh.position : null;
      for (let i = 0; i < per; i++) {
        const idx = h * per + i;
        const ix = idx * 3;
        const ex = idx * 4;
        if (!origin) {
          this.fire.pos[ix + 1] = -20;
          continue;
        }
        this.fire.extra[ex]! += dt * this.fire.extra[ex + 1]!;
        if (this.fire.extra[ex]! > 1) this.fire.extra[ex] = 0;
        const u = this.fire.extra[ex]!;
        const spin = this.fire.extra[ex + 2]!;
        const rad = this.fire.extra[ex + 3]! * (1 - u);
        this.fire.pos[ix] = origin.x + Math.cos(spin + elapsed * 2.2) * rad;
        this.fire.pos[ix + 1] = origin.y + 0.2 + u * 1.35;
        this.fire.pos[ix + 2] = origin.z + Math.sin(spin + elapsed * 2.2) * rad;
      }
    }
    (this.fire.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private updateSteam(dt: number, player: THREE.Vector3): void {
    const mat = this.steam.points.material as THREE.PointsMaterial;
    const hearth = this.camp?.nearestHearth(
      Math.round(player.x / CELL - 0.5),
      Math.round(player.z / CELL - 0.5),
      3,
    );
    const on = this.steamOn && hearth?.lit;
    mat.opacity = on ? 0.45 : 0;
    this.steam.points.visible = Boolean(on);
    if (!on || !hearth) return;
    const o = hearth.item.mesh.position;
    for (let i = 0; i < STEAM_COUNT; i++) {
      const ix = i * 3;
      this.steam.extra[i * 3]! += dt * (0.35 + (this.steam.extra[i * 3 + 1] ?? 0.4));
      if (this.steam.extra[i * 3]! > 1) {
        this.steam.extra[i * 3] = 0;
        this.steam.extra[i * 3 + 1] = 0.3 + Math.random() * 0.5;
        this.steam.extra[i * 3 + 2] = Math.random() * Math.PI * 2;
      }
      const u = this.steam.extra[i * 3]!;
      const a = this.steam.extra[i * 3 + 2]!;
      this.steam.pos[ix] = o.x + Math.cos(a) * u * 0.5 + (player.x - o.x) * 0.15;
      this.steam.pos[ix + 1] = o.y + 0.4 + u * 1.8;
      this.steam.pos[ix + 2] = o.z + Math.sin(a) * u * 0.5 + (player.z - o.z) * 0.15;
    }
    (this.steam.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private updateFlies(dt: number, player: THREE.Vector3, elapsed: number): void {
    const mat = this.flies.points.material as THREE.PointsMaterial;
    mat.opacity = this.fliesOn ? 0.9 : 0;
    this.flies.points.visible = this.fliesOn;
    if (!this.fliesOn) return;
    for (let i = 0; i < FLY_COUNT; i++) {
      const a = this.flies.extra[i * 4]! + dt * this.flies.extra[i * 4 + 1]!;
      this.flies.extra[i * 4] = a;
      const r = this.flies.extra[i * 4 + 2]!;
      const h = this.flies.extra[i * 4 + 3]!;
      const pulse = 0.55 + 0.45 * Math.sin(elapsed * 6 + i);
      this.flies.pos[i * 3] = player.x + Math.cos(a) * r + Math.sin(elapsed * 0.4 + i) * 0.4;
      this.flies.pos[i * 3 + 1] = GROUND_Y + 0.5 + h * 0.5 + Math.sin(elapsed * 2.1 + i * 0.7) * 0.25;
      this.flies.pos[i * 3 + 2] = player.z + Math.sin(a * 0.85) * r;
      void pulse;
    }
    (this.flies.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    mat.size = 0.16 + Math.sin(elapsed * 7) * 0.03;
  }

  private updateLights(torch: THREE.Vector3 | null, elapsed: number, flash: number): void {
    if (torch) {
      const flicker = 1.6 + Math.sin(elapsed * 17) * 0.22 + Math.sin(elapsed * 41) * 0.12;
      this.torchLight.position.copy(torch);
      this.torchLight.position.y += 0.22;
      this.torchLight.intensity = flicker + flash * 0.4;
    } else {
      this.torchLight.intensity = 0;
    }
    const lit = this.hearths.filter((h) => h.lit);
    for (let i = 0; i < this.fireLights.length; i++) {
      const light = this.fireLights[i]!;
      const h = lit[i];
      if (!h) {
        light.intensity = 0;
        continue;
      }
      light.position.copy(h.item.mesh.position);
      light.position.y += 0.45;
      light.intensity = 1.85 + Math.sin(elapsed * 11 + i) * 0.25 + Math.sin(elapsed * 29 + i) * 0.12 + flash * 0.3;
    }
  }
}
