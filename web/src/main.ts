import "./style.css";
import * as THREE from "three";
import { CAMERA_OFFSET, CENTER, GRID } from "./constants";
import { buildGridOverlay } from "./gridOverlay";
import { buildBiomes, buildIslandMesh, buildOcean, findSpawn } from "./island";
import { GridPlayer } from "./player";
import { scatterProps } from "./props";

const blocked = new Uint8Array(GRID * GRID);
const biomes = buildBiomes();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd4e4);
scene.fog = new THREE.Fog(0x9fd4e4, 90, 180);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(CENTER + CAMERA_OFFSET.x, CAMERA_OFFSET.y, CENTER + CAMERA_OFFSET.z);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xfff2d4, 0x3d6b3a, 0.85));
const sun = new THREE.DirectionalLight(0xfff1d0, 1.35);
sun.position.set(30, 48, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 140;
sun.shadow.camera.left = -55;
sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55;
sun.shadow.camera.bottom = -55;
sun.shadow.bias = -0.0008;
scene.add(sun);

scene.add(buildOcean());
scene.add(buildIslandMesh(biomes));

async function start(): Promise<void> {
  const spawn = findSpawn(biomes);
  blocked[spawn.z * GRID + spawn.x] = 1;

  await scatterProps(scene, biomes, blocked);
  blocked[spawn.z * GRID + spawn.x] = 0;

  scene.add(buildGridOverlay(biomes, blocked));

  const player = new GridPlayer(biomes, blocked, spawn);

  scene.add(player.mesh);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();

  function frame(): void {
    const dt = Math.min(0.05, clock.getDelta());
    player.update(dt);
    player.followCamera(camera);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  frame();
}

void start();
