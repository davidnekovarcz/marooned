import * as THREE from "three";
import { randomCharacter, saveCharacter } from "@/web/src/appearance";
import { setupIslandAudio } from "@/web/src/audio";
import { applyZoomFog, CameraZoom, offsetForZoom } from "@/web/src/cameraZoom";
import { CAMERA_OFFSET, CENTER, DAY_START, DEBUG_GRID, GRID, HUD_BLINK, SEED } from "@/web/src/constants";
import { applyDayNight, createDayLights, DayClock, isDaytime } from "@/web/src/dayNight";
import { Atmosphere } from "@/web/src/fx/atmosphere";
import { buildGridOverlay } from "@/web/src/gridOverlay";
import { Input } from "@/web/src/input/Input";
import {
  buildBiomes,
  buildCoastField,
  buildIslandMesh,
  findSpawn,
  isInlandWater,
  isPondShore,
  isShore,
} from "@/web/src/island";
import { Needs } from "@/web/src/needs";
import { buildOcean } from "@/web/src/ocean";
import { GridPlayer } from "@/web/src/actor/player";
import { loadPlayerModel } from "@/web/src/playerModel";
import { scatterProps } from "@/web/src/props";
import { Actions, type ResolvedAction } from "@/web/src/sim/actions";
import { Camp, countNearby } from "@/web/src/sim/camp";
import { Loot } from "@/web/src/sim/loot";
import { Interactor } from "@/web/src/sim/useItem";
import { Weather } from "@/web/src/sim/weather";
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
import { Item } from "@/web/src/world/item";

const _torch = new THREE.Vector3();

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
    const islandMesh = buildIslandMesh(biomes);
    scene.add(islandMesh);

    const character = randomCharacter();
    saveCharacter(character);

    const spawn = findSpawn(biomes);
    blocked[spawn.z * GRID + spawn.x] = 1;

    const worldP = (async () => {
      const scattered = await scatterProps(scene, biomes, blocked);
      const loot = new Loot(scattered.lootSites, scattered.items, scattered.spawn, spawn);
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

    const camp = new Camp();
    camp.scan(scattered.items);
    const weather = new Weather();
    const atmosphere = new Atmosphere(scene);
    atmosphere.attachIsland(islandMesh);
    atmosphere.bindCamp(camp);

    const ui = useUiStore();
    const islandAudio = setupIslandAudio(scene, player, scattered.audioAnchors, coast, camp, () => {
      ui.audioUnlocked = true;
    });
    const needs = new Needs();
    const day = new DayClock();
    const zoom = new CameraZoom();
    const actions = new Actions();
    const interactor = new Interactor(
      scattered.items,
      needs,
      player,
      islandAudio,
      scattered.spawn,
      actions,
      camp,
      (item) => loot.onRemoved(item),
    );
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
      weather,
    });

    const offset = offsetForZoom(camera, zoom.cells);
    applyZoomFog(scene, camera, offset.length(), zoom.cells, day.t, weather.intensity);
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

    const applyAction = (action: ResolvedAction, item: Item | null, kind: string | null) => {
      currentItem = item;
      currentAction = action;
      ui.nearbyItemId = item?.id ?? null;
      ui.promptKind = kind;
      ui.promptPrep = item?.prep;
      ui.promptFreshness = item?.freshness;
      ui.actionId = action.id;
      ui.actionBlocked = action.blocked;
    };

    const frame = (): void => {
      if (dead) return;
      const dt = Math.min(0.05, clock.getDelta());
      zoom.update(dt, input.zoomDir);
      player.canSprint = needs.canSprint;
      player.update(dt);
      wildlife.update(dt);
      loot.update(dt, player.cellX, player.cellZ);
      weather.update(dt, day.t, day.elapsed);
      if (weather.raining) camp.douseExposed();
      const daytime = isDaytime(day.t);
      const sheltered = camp.covered(player.cellX, player.cellZ);
      const fireWarmth = camp.warmthAt(player.cellX, player.cellZ);
      const torchHeld = player.heldKind === "torch";
      needs.tick(player.gait, dt, {
        daytime,
        rain: weather.intensity,
        sheltered,
        fire: fireWarmth,
        torch: torchHeld,
        swimming: player.inWater(),
      });
      day.update(dt);
      applyDayNight(scene, lights, day.t, weather.intensity, weather.flash);
      ocean.update(clock.elapsedTime, weather.intensity);
      islandAudio.update(weather.intensity, sheltered);
      const camOffset = offsetForZoom(camera, zoom.cells);
      applyZoomFog(scene, camera, camOffset.length(), zoom.cells, day.t, weather.intensity);
      player.followCamera(camera, camOffset);

      atmosphere.setRain(weather.intensity);
      atmosphere.setWetGround(Math.max(weather.intensity * 0.85, needs.wetness * 0.35));
      atmosphere.setSteam(needs.wetness > 0.25 && fireWarmth > 0.2);
      atmosphere.setFireflies(weather.fireflies(!daytime));
      let torchPos: THREE.Vector3 | null = null;
      if (torchHeld && player.heldMesh) {
        player.heldMesh.getWorldPosition(_torch);
        torchPos = _torch;
      }
      atmosphere.update(dt, player.mesh.position, torchPos, clock.elapsedTime, weather.flash, day.t);

      if (!player.alive || player.busy) {
        currentItem = null;
        currentAction = null;
        ui.actionId = null;
        ui.actionBlocked = undefined;
        ui.nearbyItemId = null;
        ui.promptKind = null;
      } else {
        const hearth = camp.nearestHearth(player.cellX, player.cellZ);
        const inland = isInlandWater(player.cellX, player.cellZ, biomes);
        const context = actions.context({
          held: player.heldKind,
          inWater: inland,
          onShore: isShore(player.cellX, player.cellZ, biomes),
          atFreshWater: inland || isPondShore(player.cellX, player.cellZ, biomes),
          nearLitFire: Boolean(hearth?.lit),
          nearUnlitFire: Boolean(hearth && !hearth.lit),
          raining: weather.raining,
          fireSheltered: hearth ? camp.covered(hearth.item.cellX, hearth.item.cellZ) : false,
          sticks: countNearby("stick", player, scattered.items, player.cellX, player.cellZ),
          fiber: countNearby("fiber", player, scattered.items, player.cellX, player.cellZ),
        });
        const heldMeal = actions.heldMeal(player.heldKind, player.heldMesh);
        const next = actions.nearest(scattered.items, player.cellX, player.cellZ, player.heldKind);
        const worldAction = next ? actions.world(next, player.heldKind) : undefined;
        // Survival verbs beat loot at your feet (a coconut used to hide Drink / Fish / Light).
        if (context?.cook) {
          applyAction(context, null, player.heldKind);
          const inv = player.inventory.snapshot();
          ui.promptPrep = inv.heldPrep;
          ui.promptFreshness = inv.heldFreshness;
        } else if (context?.id === "light" && hearth) {
          applyAction(context, hearth.item, hearth.item.kind);
        } else if (context?.build) {
          applyAction(context, null, "leanTo");
        } else if (context?.pond) {
          applyAction(context, null, "pond");
        } else if (context?.id === "fish") {
          applyAction(context, null, "shore");
        } else if (heldMeal) {
          applyAction(heldMeal, null, player.heldKind);
          const inv = player.inventory.snapshot();
          ui.promptPrep = inv.heldPrep;
          ui.promptFreshness = inv.heldFreshness;
        } else if (next && worldAction) {
          applyAction(worldAction, next, next.kind);
        } else {
          const animal = wildlife.nearest(player.cellX, player.cellZ);
          currentItem = null;
          currentAction = null;
          ui.actionId = null;
          ui.actionBlocked = undefined;
          ui.nearbyItemId = null;
          ui.promptKind = animal;
          ui.promptPrep = undefined;
          ui.promptFreshness = undefined;
        }
      }

      const pocket = input.consumePocket() ?? ui.consumePocket();
      if (pocket) interactor.pocket(pocket);
      const wantInteract = input.consumeInteract() || ui.consumeInteract();
      if (wantInteract && currentAction && actions.enabled(currentAction)) {
        if (interactor.perform(currentAction, currentItem)) {
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
        weather,
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
    ctx: { day: DayClock; needs: Needs; player: GridPlayer; items: Item[]; weather: Weather },
  ): void {
    const snap = ctx.needs.snapshot();
    session.$patch({
      dayT: ctx.day.t,
      clock: ctx.day.clockLabel(),
      survivedHours: ctx.day.survivedGameHours(),
      alive: ctx.player.alive,
      sky: ctx.weather.sky(isDaytime(ctx.day.t)),
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
    worldStore.$patch({ items: ctx.items.map((item) => item.snapshot()) });
    void ui;
  }
}
