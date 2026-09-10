import * as THREE from "three";
import { randomCharacter, saveCharacter } from "@/web/src/appearance";
import { setupIslandAudio } from "@/web/src/audio";
import { applyZoomFog, CameraZoom, offsetForZoom } from "@/web/src/cameraZoom";
import { CAMERA_OFFSET, CENTER, DAY_START, DEBUG_GRID, GRID, HUD_BLINK, SEED } from "@/web/src/constants";
import { applyDayNight, createDayLights, DayClock, isDaytime } from "@/web/src/dayNight";
import { buildGridOverlay } from "@/web/src/gridOverlay";
import { Input } from "@/web/src/input/Input";
import { buildBiomes, buildCoastField, buildIslandMesh, findSpawn } from "@/web/src/island";
import { Needs } from "@/web/src/needs";
import { buildOcean } from "@/web/src/ocean";
import { GridPlayer } from "@/web/src/actor/player";
import { loadPlayerModel } from "@/web/src/playerModel";
import { scatterProps } from "@/web/src/props";
import { actionEnabled, nearestItem, resolveHeldMeal, resolveWorldAction } from "@/web/src/sim/actions";
import { createLoot } from "@/web/src/sim/loot";
import { applyPocketCommand, performAction } from "@/web/src/sim/useItem";
import {
  useInventoryStore,
  useNeedsStore,
  usePlayerStore,
  useSessionStore,
  useUiStore,
  useWorldStore,
} from "@/web/src/stores/game";
import { mountUi } from "@/web/src/view/mount";
import { spawnWildlife } from "@/web/src/wildlife";
import { itemSnapshot, type Item } from "@/web/src/world/item";
import type { ResolvedAction } from "@/web/src/sim/actions";

export class Game {
  static async start(): Promise<void> {
    const game = new Game();
    await game.boot();
  }

  private constructor() {}

  private boot = async (): Promise<void> => {
    const uiRoot = document.getElementById("ui");
    if (!uiRoot) throw new Error("UI root #ui missing from index.html");
    mountUi(uiRoot);

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
    renderer.domElement.id = "game";
    document.body.appendChild(renderer.domElement);

    const lights = createDayLights(scene);
    applyDayNight(scene, lights, DAY_START);
    const ocean = buildOcean();
    scene.add(ocean.mesh);
    scene.add(buildIslandMesh(biomes));

    const character = randomCharacter();
    saveCharacter(character);

    const spawn = findSpawn(biomes);
    blocked[spawn.z * GRID + spawn.x] = 1;

    const worldP = (async () => {
      const scattered = await scatterProps(scene, biomes, blocked);
      const loot = createLoot(scattered.lootSites, scattered.items, scattered.spawn);
      const wildlife = await spawnWildlife(scene, biomes, blocked);
      blocked[spawn.z * GRID + spawn.x] = 0;
      if (DEBUG_GRID) scene.add(buildGridOverlay(biomes, blocked));
      return { scattered, loot, wildlife };
    })();
    const visualP = loadPlayerModel(character);
    const [{ scattered, loot, wildlife }, visual] = await Promise.all([worldP, visualP]);

    const input = new Input();
    const player = new GridPlayer(biomes, blocked, spawn, visual, input);
    scene.add(player.mesh);

    const ui = useUiStore();
    const islandAudio = setupIslandAudio(scene, player, scattered.audioAnchors, coast, () => {
      ui.audioUnlocked = true;
    });
    const needs = new Needs();
    const day = new DayClock();
    const zoom = new CameraZoom();
    const session = useSessionStore();
    const needsStore = useNeedsStore();
    const playerStore = usePlayerStore();
    const inventoryStore = useInventoryStore();
    const worldStore = useWorldStore();

    session.seed = SEED;
    this.patchStores(session, needsStore, playerStore, inventoryStore, worldStore, ui, {
      day,
      needs,
      player,
      items: scattered.items,
    });

    const offset = offsetForZoom(camera, zoom.cells);
    applyZoomFog(scene, camera, offset.length(), zoom.cells, day.t);
    player.followCamera(camera, offset);
    applyDayNight(scene, lights, day.t);
    renderer.render(scene, camera);
    document.body.classList.remove("gate");

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const clock = new THREE.Clock();
    let dead = false;
    let currentItem: Item | null = null;
    let currentAction: ResolvedAction | null = null;

    const applyHealthLook = (health: number): void => {
      const gray = (1 - health) * 100;
      const bright = health < HUD_BLINK ? health / HUD_BLINK : 1;
      renderer.domElement.style.filter = `grayscale(${gray}%) brightness(${bright})`;
    };

    const frame = (): void => {
      if (dead) return;
      const dt = Math.min(0.05, clock.getDelta());
      zoom.update(dt, input.zoomDir);
      player.canSprint = needs.canSprint;
      player.update(dt);
      wildlife.update(dt);
      loot.update(dt, player.cellX, player.cellZ);
      needs.tick(player.gait, dt, isDaytime(day.t));
      day.update(dt);
      applyDayNight(scene, lights, day.t);
      ocean.update(clock.elapsedTime);
      islandAudio.update();
      const camOffset = offsetForZoom(camera, zoom.cells);
      applyZoomFog(scene, camera, camOffset.length(), zoom.cells, day.t);
      player.followCamera(camera, camOffset);

      if (!player.alive || player.busy) {
        currentItem = null;
        currentAction = null;
        ui.actionId = null;
        ui.nearbyItemId = null;
        ui.promptKind = null;
      } else {
        const heldMeal = resolveHeldMeal(player.heldKind, player.heldMesh);
        const next = nearestItem(scattered.items, player.cellX, player.cellZ, player.heldKind);
        const worldAction = next ? resolveWorldAction(next, player.heldKind) : undefined;
        if (heldMeal) {
          currentItem = null;
          currentAction = heldMeal;
          ui.nearbyItemId = null;
          ui.promptKind = player.heldKind;
          const inv = player.inventory.snapshot();
          ui.promptPrep = inv.heldPrep;
          ui.promptFreshness = inv.heldFreshness;
          ui.actionId = heldMeal.id;
          ui.actionBlocked = heldMeal.blocked;
        } else if (next && worldAction) {
          currentItem = next;
          currentAction = worldAction;
          ui.nearbyItemId = next.id;
          ui.promptKind = next.kind;
          ui.promptPrep = next.prep;
          ui.promptFreshness = next.freshness;
          ui.actionId = worldAction.id;
          ui.actionBlocked = worldAction.blocked;
        } else {
          currentItem = null;
          currentAction = null;
          ui.actionId = null;
          ui.nearbyItemId = null;
          ui.promptKind = null;
        }
      }

      const pocket = input.consumePocket() ?? ui.consumePocket();
      if (pocket) applyPocketCommand(pocket, scattered.items, player, islandAudio);
      const wantInteract = input.consumeInteract() || ui.consumeInteract();
      if (wantInteract && currentAction && actionEnabled(currentAction)) {
        if (performAction(currentAction, currentItem, scattered.items, needs, player, islandAudio, scattered.spawn, loot.onRemoved)) {
          currentItem = null;
          currentAction = null;
          ui.actionId = null;
        }
      }

      this.patchStores(session, needsStore, playerStore, inventoryStore, worldStore, ui, {
        day,
        needs,
        player,
        items: scattered.items,
      });
      applyHealthLook(needs.health);
      renderer.render(scene, camera);
      if (needs.health <= 0) {
        dead = true;
        player.alive = false;
        ui.dead = true;
        ui.deathHours = day.survivedGameHours();
        document.body.classList.add("dead");
        applyHealthLook(0);
        return;
      }
      requestAnimationFrame(frame);
    };

    frame();
  };

  private patchStores(
    session: ReturnType<typeof useSessionStore>,
    needsStore: ReturnType<typeof useNeedsStore>,
    playerStore: ReturnType<typeof usePlayerStore>,
    inventoryStore: ReturnType<typeof useInventoryStore>,
    worldStore: ReturnType<typeof useWorldStore>,
    ui: ReturnType<typeof useUiStore>,
    ctx: { day: DayClock; needs: Needs; player: GridPlayer; items: Item[] },
  ): void {
    const snap = ctx.needs.snapshot();
    session.$patch({
      dayT: ctx.day.t,
      clock: ctx.day.clockLabel(),
      survivedHours: ctx.day.survivedGameHours(),
      alive: ctx.player.alive,
      sky: isDaytime(ctx.day.t) ? "sun" : "moon",
    });
    needsStore.$patch(snap);
    playerStore.$patch({
      cellX: ctx.player.cellX,
      cellZ: ctx.player.cellZ,
      gait: ctx.player.gait,
      heldKind: ctx.player.heldKind,
      busy: ctx.player.busy,
    });
    inventoryStore.$patch(ctx.player.inventory.snapshot());
    worldStore.$patch({ items: ctx.items.map(itemSnapshot) });
    void ui;
  }
}
