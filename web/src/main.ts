import "./style.css";
import * as THREE from "three";
import { DEFAULT_APPEARANCE } from "./appearance";
import { setupIslandAudio } from "./audio";
import { applyZoomFog, CameraZoom, offsetForZoom } from "./cameraZoom";
import { CAMERA_OFFSET, CENTER, DAY_START, GRID } from "./constants";
import { applyDayNight, createDayLights, DayClock } from "./dayNight";
import { buildGridOverlay } from "./gridOverlay";
import { createHud } from "./hud";
import { buildBiomes, buildCoastField, buildIslandMesh, buildOcean, findSpawn } from "./island";
import { Needs } from "./needs";
import { GridPlayer } from "./player";
import { loadPlayerModel } from "./playerModel";
import { scatterProps } from "./props";

const blocked = new Uint8Array(GRID * GRID);
const biomes = buildBiomes();
const coast = buildCoastField(biomes);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd4e4);
scene.fog = new THREE.Fog(0x9fd4e4, 130, 300);

const camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 420);
camera.position.set(CENTER + CAMERA_OFFSET.x, CAMERA_OFFSET.y, CENTER + CAMERA_OFFSET.z);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const lights = createDayLights(scene);
applyDayNight(scene, lights, DAY_START);

scene.add(buildOcean());
scene.add(buildIslandMesh(biomes));

async function start(): Promise<void> {
  const spawn = findSpawn(biomes);
  blocked[spawn.z * GRID + spawn.x] = 1;

  const scattered = await scatterProps(scene, biomes, blocked);
  blocked[spawn.z * GRID + spawn.x] = 0;

  scene.add(buildGridOverlay(biomes, blocked));

  const visual = await loadPlayerModel(DEFAULT_APPEARANCE);
  const player = new GridPlayer(biomes, blocked, spawn, visual);
  scene.add(player.mesh);

  const islandAudio = setupIslandAudio(scene, player, scattered.audioAnchors, coast);
  const hud = createHud();
  const needs = new Needs();
  const day = new DayClock();
  hud.update({ weather: "sun", clock: day.clockLabel(), ...needs.snapshot() });

  const zoom = new CameraZoom();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();

  function frame(): void {
    const dt = Math.min(0.05, clock.getDelta());
    zoom.update(dt);
    player.canSprint = needs.canSprint;
    player.update(dt);
    needs.tick(player.gait, dt);
    day.update(dt);
    applyDayNight(scene, lights, day.t);
    islandAudio.update();
    const offset = offsetForZoom(camera, zoom.cells);
    applyZoomFog(scene, camera, offset.length(), zoom.cells);
    player.followCamera(camera, offset);
    hud.update({ weather: "sun", clock: day.clockLabel(), ...needs.snapshot() });
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  frame();
}

void start();
