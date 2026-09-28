import * as THREE from "three";
import { loadSavedCharacter, randomCharacter, saveCharacter, type Character } from "@/web/src/appearance";
import { showCharacterSelect } from "@/web/src/characterSelect";
import { setupIslandAudio } from "@/web/src/audio";
import { applyZoomFog, CameraZoom, offsetForZoom } from "@/web/src/cameraZoom";
import { CAMERA_OFFSET, CENTER, DAY_START, DEBUG_GRID, GRID, HUD_BLINK, SEED, AFK_SECONDS, ZOOM_CELLS_IN } from "@/web/src/constants";
import { applyDayNight, createDayLights, DayClock, isDaytime, livedHoursFromSeconds } from "@/web/src/dayNight";
import { Atmosphere } from "@/web/src/fx/atmosphere";
import { syncPlayerChips, type PlayerChipState } from "@/web/src/fx/playerChip";
import { buildGridOverlay, canEnter } from "@/web/src/gridOverlay";
import { Input } from "@/web/src/input/Input";
import { bindMobileInput } from "@/web/src/input/mobileBind";
import { isMobileUi } from "@/web/src/input/mobileUi";
import {
  buildBiomes,
  buildCoastField,
  buildIslandMesh,
  findSpawn,
  findSpawns,
  isInlandWater,
  isPondShore,
  isShore,
} from "@/web/src/island";
import { Needs } from "@/web/src/needs";
import { buildOcean } from "@/web/src/ocean";
import type { StowedGear } from "@/web/src/actor/inventory";
import { GridPlayer } from "@/web/src/actor/player";
import { RemotePlayer } from "@/web/src/actor/remotePlayer";
import { loadPlayerModel } from "@/web/src/playerModel";
import { scatterProps } from "@/web/src/props";
import { Actions, type ResolvedAction } from "@/web/src/sim/actions";
import { applyHostIntent } from "@/web/src/net/hostIntents";
import { liveSay, PLAYER_HZ, SAY_MAX, WORLD_HZ, roomIdFromUrl, type NetIntent } from "@/web/src/net/protocol";
import { joinRoom, type Room } from "@/web/src/net/room";
import {
  consumeForceRespawn,
  emptyInventory,
  loadLocalSurvivor,
  saveLocalSurvivor,
  SURVIVOR_HZ,
  type NetSurvivor,
} from "@/web/src/net/survivor";
import {
  applyNetWorld,
  snapshotWorld,
  spawnFromSnapshot,
  takeCarriedItem,
  type ClaimedHearth,
  type ClaimedPickup,
} from "@/web/src/net/worldSync";
import { gatherPromptCandidates, pickPrompt, smokePromptPriority, type PromptChoice } from "@/web/src/sim/prompt";
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
import type { HeldKind } from "@/web/src/world/kinds";

const _torch = new THREE.Vector3();
const _torches: THREE.Vector3[] = [];
const _remoteTorches = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

/** Living refresh keeps the body; a full room skips the card; otherwise pick a look. */
async function resolveCharacter(continueAs: Character | undefined, islandFull: boolean): Promise<Character> {
  if (continueAs) return continueAs;
  if (islandFull) return loadSavedCharacter() ?? randomCharacter();
  return showCharacterSelect();
}

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

    const ui = useUiStore();
    const join = await joinRoom();
    if (join.kind === "full") ui.islandFull = true;
    const room: Room | null = join.kind === "joined" ? join.room : null;
    if (room) {
      ui.netRoom = room.roomId;
      ui.netHost = room.isHost;
    }

    const persistRoomId = room?.roomId ?? roomIdFromUrl();
    const respawn = consumeForceRespawn();
    let saved: NetSurvivor | null = null;
    if (!respawn) {
      saved = room ? await room.loadSurvivor() : null;
      saved = saved ?? loadLocalSurvivor(persistRoomId);
    }

    const freshSpawn = respawn || !saved?.alive;
    const spawns = findSpawns(biomes);
    const slotSpawn = room ? (spawns[room.slot] ?? findSpawn(biomes)) : findSpawn(biomes);
    let spawn = slotSpawn;
    if (saved && canEnter(biomes, blocked, saved.cellX, saved.cellZ)) {
      spawn = { x: saved.cellX, z: saved.cellZ };
    }
    for (const cell of spawns) blocked[cell.z * GRID + cell.x] = 1;

    const worldP = (async () => {
      const scattered = await scatterProps(scene, biomes, blocked);
      const loot = new Loot(scattered.lootSites, scattered.items, scattered.spawn, spawn);
      const wildlife = await spawnWildlife(scene, biomes, blocked);
      for (const cell of spawns) blocked[cell.z * GRID + cell.x] = 0;
      if (DEBUG_GRID) scene.add(buildGridOverlay(biomes, blocked));
      return { scattered, loot, wildlife };
    })();

    const character = await resolveCharacter(!freshSpawn ? saved?.character : undefined, ui.islandFull);
    saveCharacter(character);
    const [{ scattered, loot, wildlife }, visual] = await Promise.all([worldP, loadPlayerModel(character)]);

    const input = new Input();
    bindMobileInput(input);
    const player = new GridPlayer(biomes, blocked, spawn, visual, input);
    if (saved && typeof saved.yaw === "number" && Number.isFinite(saved.yaw)) {
      player.mesh.rotation.y = saved.yaw;
    }
    scene.add(player.mesh);

    const camp = new Camp();
    camp.scan(scattered.items);
    const weather = new Weather();
    const day = new DayClock();
    const savedWorld = room ? await room.loadWorld() : null;
    if (savedWorld) {
      applyNetWorld(savedWorld, scattered.items, scattered.spawn, camp, day, weather, (item) => loot.onRemoved(item));
    }
    const atmosphere = new Atmosphere(scene);
    atmosphere.attachIsland(islandMesh);
    atmosphere.bindCamp(camp);

    const islandAudio = setupIslandAudio(scene, player, scattered.audioAnchors, coast, camp, () => {
      ui.audioUnlocked = true;
    });
    const needs = new Needs();
    if (saved) needs.restore(saved.needs);
    const zoom = new CameraZoom();
    const actions = new Actions();
    smokePromptPriority();
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
      livedSeconds: saved?.alive ? saved.livedSeconds : 0,
      afk: false,
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
    const remotes = new Map<string, RemotePlayer>();
    let playerSend = 0;
    let worldSend = 0;
    let survivorSend = 0;
    let lastSurvivorJson = "";
    let intentSeq = 0;
    const lastIntentSeq = new Map<string, number>();
    const claimedPickups: ClaimedPickup[] = [];
    const claimedHearths: ClaimedHearth[] = [];
    const onRemoved = (item: Item): void => loot.onRemoved(item);
    let hostCaughtWorld = Boolean(savedWorld);
    let hostCatchWait = 0;

    const equipGear = (gear: StowedGear | null, stow: boolean): void => {
      if (!gear) return;
      const item = takeCarriedItem(
        scattered.spawn,
        scattered.items,
        onRemoved,
        gear.kind,
        player.cellX,
        player.cellZ,
        { prep: gear.prep, freshness: gear.freshness },
      );
      if (!item) return;
      player.inventory.grabHeld(item.mesh, gear.kind);
      if (stow) player.inventory.stowHeld();
    };
    if (saved?.alive) {
      equipGear(saved.inventory.left, true);
      equipGear(saved.inventory.right, true);
      equipGear(saved.inventory.held, false);
    }

    let livedSeconds = saved?.alive ? saved.livedSeconds : 0;
    let lastInputAt = Date.now();
    let afk = false;
    let localSay = "";
    let localSayAt = 0;

    const closeChat = (): void => {
      ui.chatOpen = false;
      ui.chatDraft = "";
      input.setComposing(false);
    };

    const persistSurvivor = (alive: boolean, deathHours = 0): void => {
      const snap = needs.snapshot();
      const row: NetSurvivor = {
        character,
        needs: {
          energy: snap.energy,
          thirst: snap.thirst,
          hunger: snap.hunger,
          temperature: snap.temperature,
          wetness: snap.wetness,
          health: alive ? snap.health : 0,
        },
        inventory: alive ? player.inventory.persistGear() : emptyInventory(),
        cellX: player.cellX,
        cellZ: player.cellZ,
        yaw: player.mesh.rotation.y,
        alive,
        deathHours,
        livedSeconds,
        updatedAt: Date.now(),
      };
      const json = JSON.stringify({ ...row, updatedAt: 0 });
      if (json === lastSurvivorJson) return;
      lastSurvivorJson = json;
      saveLocalSurvivor(persistRoomId, row);
      if (room) void room.saveSurvivor(row);
    };

    window.addEventListener("pagehide", () => {
      persistSurvivor(player.alive && !dead, ui.deathHours);
    });

    const applyHealthLook = (health: number): void => {
      const gray = (1 - health) * 100;
      const bright = health < HUD_BLINK ? health / HUD_BLINK : 1;
      renderer.domElement.style.filter = `grayscale(${gray}%) brightness(${bright})`;
    };

    const applyChoice = (choice: PromptChoice | undefined): void => {
      if (!choice) {
        currentItem = null;
        currentAction = null;
        ui.nearbyItemId = null;
        ui.promptKind = null;
        ui.promptPrep = undefined;
        ui.promptFreshness = undefined;
        ui.actionId = null;
        ui.actionBlocked = undefined;
        return;
      }
      currentItem = choice.item;
      currentAction = choice.action;
      ui.nearbyItemId = choice.item?.id ?? null;
      ui.promptKind = choice.promptKind;
      ui.promptPrep = choice.promptPrep;
      ui.promptFreshness = choice.promptFreshness;
      ui.actionId = choice.action?.id ?? null;
      ui.actionBlocked = choice.action?.blocked;
    };

    const frame = (): void => {
      if (dead) return;
      const dt = Math.min(0.05, clock.getDelta());
      const now = Date.now();
      if (input.consumeCancelChat()) closeChat();
      if (input.consumeSendChat()) {
        const line = ui.chatDraft.replace(/\s+/g, " ").trim().slice(0, SAY_MAX);
        closeChat();
        if (line && player.alive && !liveSay(localSay, localSayAt, now)) {
          localSay = line;
          localSayAt = now;
          lastInputAt = now;
        }
      }
      if (
        (input.consumeOpenChat() || ui.consumeOpenChat()) &&
        player.alive &&
        !ui.dead &&
        !ui.islandFull &&
        !liveSay(localSay, localSayAt, now)
      ) {
        ui.chatOpen = true;
        ui.chatDraft = "";
        input.setComposing(true);
      }
      input.setComposing(ui.chatOpen);
      if (isMobileUi()) zoom.cells = ZOOM_CELLS_IN;
      else zoom.update(dt, input.zoomDir);
      player.canSprint = needs.canSprint;
      if (input.moveDir()) lastInputAt = Date.now();
      afk = player.alive && (Date.now() - lastInputAt) / 1000 >= AFK_SECONDS;
      player.update(dt);
      wildlife.update(dt);
      const hosting = !room || room.isHost;
      if (hosting) {
        if (room && !hostCaughtWorld) {
          const live = room.latestWorld();
          if (live) {
            try {
              applyNetWorld(
                live,
                scattered.items,
                scattered.spawn,
                camp,
                day,
                weather,
                onRemoved,
                claimedPickups,
                claimedHearths,
              );
            } catch (err) {
              console.warn("applyNetWorld failed", err);
            }
            hostCaughtWorld = true;
          } else {
            hostCatchWait += dt;
            if (hostCatchWait > 0.75) hostCaughtWorld = true;
          }
        }
        loot.update(dt, player.cellX, player.cellZ);
        weather.update(dt, day.t, day.elapsed);
        if (weather.raining) camp.douseExposed();
        day.update(dt);
      } else if (room) {
        const world = room.latestWorld();
        if (world) {
          const ahead = typeof world.elapsed === "number" && Number.isFinite(world.elapsed) && world.elapsed > day.elapsed;
          try {
            applyNetWorld(
              world,
              scattered.items,
              scattered.spawn,
              camp,
              day,
              weather,
              onRemoved,
              claimedPickups,
              claimedHearths,
              { clock: ahead },
            );
          } catch (err) {
            console.warn("applyNetWorld failed", err);
          }
          if (!ahead) {
            day.update(dt);
            weather.update(dt, day.t, day.elapsed);
          }
        } else {
          day.update(dt);
          weather.update(dt, day.t, day.elapsed);
        }
      }
      const daytime = isDaytime(day.t);
      const sheltered = camp.covered(player.cellX, player.cellZ);
      const fireWarmth = camp.warmthAt(player.cellX, player.cellZ);
      const torchHeld = player.heldKind === "torch";
      if (!afk) {
        needs.tick(player.gait, dt, {
          daytime,
          rain: weather.intensity,
          sheltered,
          fire: fireWarmth,
          torch: torchHeld,
          swimming: player.inWater(),
        });
      }
      applyDayNight(scene, lights, day.t, weather.intensity, weather.flash);
      ocean.update(clock.elapsedTime, weather.intensity);
      islandAudio.update(weather.intensity, sheltered, afk);
      const camOffset = offsetForZoom(camera, zoom.cells);
      applyZoomFog(scene, camera, camOffset.length(), zoom.cells, day.t, weather.intensity);
      player.followCamera(camera, camOffset);

      atmosphere.setRain(weather.intensity);
      atmosphere.setWetGround(Math.max(weather.intensity * 0.85, needs.wetness * 0.35));
      atmosphere.setSteam(needs.wetness > 0.25 && fireWarmth > 0.2);
      atmosphere.setFireflies(weather.fireflies(!daytime));
      if (room) {
        const seen = new Set<string>();
        for (const net of room.remotes) {
          seen.add(net.uid);
          let remote = remotes.get(net.uid);
          if (!remote) {
            remote = new RemotePlayer(net.uid);
            remotes.set(net.uid, remote);
          }
          void remote.ensure(scene, net.appearance);
          remote.apply(net, dt);
        }
        for (const [uid, remote] of remotes) {
          if (seen.has(uid)) continue;
          remote.dispose();
          remotes.delete(uid);
        }
      }
      _torches.length = 0;
      if (torchHeld && player.heldMesh) {
        player.heldMesh.getWorldPosition(_torch);
        _torches.push(_torch);
      }
      if (room) {
        let remoteTorchI = 0;
        for (const net of room.remotes) {
          if (net.heldKind !== "torch" || remoteTorchI >= _remoteTorches.length) continue;
          const remote = remotes.get(net.uid);
          if (!remote?.visual) continue;
          const pos = _remoteTorches[remoteTorchI++]!;
          if (remote.heldMesh) remote.heldMesh.getWorldPosition(pos);
          else {
            pos.copy(remote.visual.root.position);
            pos.y += 1.1;
          }
          _torches.push(pos);
        }
      }
      atmosphere.update(dt, player.mesh.position, _torches, clock.elapsedTime, weather.flash, day.t);

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
        const places = actions.context({
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
        const inv = player.inventory.snapshot();
        applyChoice(
          pickPrompt(
            gatherPromptCandidates({
              places,
              hearth: hearth?.item ?? null,
              heldKind: player.heldKind,
              heldPrep: inv.heldPrep,
              heldFreshness: inv.heldFreshness,
              heldMeal,
              worldItem: next,
              worldAction,
              wildlife: wildlife.nearest(player.cellX, player.cellZ),
            }),
          ),
        );
      }

      const pocket = ui.chatOpen ? null : (input.consumePocket() ?? ui.consumePocket());
      if (pocket) {
        lastInputAt = Date.now();
        if (room && !room.isHost && pocket === "drop") {
          const kind = player.heldKind;
          const dropped = player.dropHeld();
          if (dropped) {
            dropped.mesh.removeFromParent();
            intentSeq += 1;
            const intent: NetIntent = {
              seq: intentSeq,
              uid: room.uid,
              cellX: player.cellX,
              cellZ: player.cellZ,
              heldKind: null,
              pocket: "drop",
              dropKind: kind ?? dropped.kind,
            };
            void room.sendIntent(intent);
          }
        } else {
          interactor.pocket(pocket);
        }
      }
      const wantInteract = !ui.chatOpen && (input.consumeInteract() || ui.consumeInteract());
      if (wantInteract) lastInputAt = Date.now();
      if (wantInteract && currentAction && actions.enabled(currentAction)) {
        const action = currentAction;
        const target = currentItem;
        const localOnly = Boolean(action.eatHeld || action.pond);
        const pickHere = Boolean(action.pickup);
        const lightHere = Boolean(action.light);
        if (!room || room.isHost || localOnly || pickHere || lightHere) {
          if (interactor.perform(action, target)) {
            if (room && !room.isHost && pickHere && target) {
              claimedPickups.push({
                id: target.id,
                kind: target.kind,
                cellX: target.cellX,
                cellZ: target.cellZ,
              });
              intentSeq += 1;
              void room.sendIntent({
                seq: intentSeq,
                uid: room.uid,
                cellX: player.cellX,
                cellZ: player.cellZ,
                heldKind: player.heldKind,
                interact: true,
                itemId: target.id,
                action,
                taken: true,
              });
            } else if (room && !room.isHost && lightHere) {
              if (target) claimedHearths.push({ cellX: target.cellX, cellZ: target.cellZ });
              intentSeq += 1;
              void room.sendIntent({
                seq: intentSeq,
                uid: room.uid,
                cellX: player.cellX,
                cellZ: player.cellZ,
                heldKind: player.heldKind,
                interact: true,
                itemId: target?.id ?? null,
                action,
              });
            }
            currentItem = null;
            currentAction = null;
            ui.actionId = null;
          }
        } else {
          intentSeq += 1;
          const intent: NetIntent = {
            seq: intentSeq,
            uid: room.uid,
            cellX: player.cellX,
            cellZ: player.cellZ,
            heldKind: player.heldKind,
            interact: true,
            itemId: target?.id ?? null,
            action,
          };
          void room.sendIntent(intent);
          currentItem = null;
          currentAction = null;
          ui.actionId = null;
        }
      }

      afk = player.alive && (Date.now() - lastInputAt) / 1000 >= AFK_SECONDS;
      if (player.alive && !afk) livedSeconds += dt;

      if (room) {
        ui.netHost = room.isHost;
        playerSend += dt;
        if (playerSend >= 1 / PLAYER_HZ) {
          playerSend = 0;
          void room.publishPlayer({
            uid: room.uid,
            slot: room.slot,
            cellX: player.cellX,
            cellZ: player.cellZ,
            gait: player.gait,
            yaw: player.mesh.rotation.y,
            heldKind: player.heldKind,
            alive: player.alive,
            name: character.name,
            appearance: { gender: character.gender, skin: character.skin, clothes: character.clothes },
            ...(afk ? { afk: true } : {}),
            ...(liveSay(localSay, localSayAt) ? { say: localSay, sayAt: localSayAt } : {}),
          });
        }
        if (room.isHost) {
          for (const intent of room.consumeIntents()) {
            if (intent.uid === room.uid) continue;
            const prev = lastIntentSeq.get(intent.uid) ?? 0;
            if (intent.seq <= prev) {
              void room.clearIntent(intent.uid);
              continue;
            }
            lastIntentSeq.set(intent.uid, intent.seq);
            const grant = applyHostIntent(intent, scattered.items, camp, scattered.spawn, onRemoved);
            if (grant) void room.sendGrant(intent.uid, grant);
            else void room.clearIntent(intent.uid);
          }
          worldSend += dt;
          if (worldSend >= 1 / WORLD_HZ && hostCaughtWorld) {
            worldSend = 0;
            try {
              void room.publishWorld(snapshotWorld(scattered.items, camp, day, weather));
            } catch (err) {
              console.warn("snapshotWorld failed", err);
            }
          }
        } else {
          const grant = room.consumeGrant();
          if (
            grant?.pickup &&
            !claimedPickups.some((claim) => claim.id === grant.pickup?.id || claim.kind === grant.pickup?.kind)
          ) {
            const spawned = spawnFromSnapshot(scattered.spawn, grant.pickup);
            if (spawned) {
              player.inventory.grabHeld(spawned.mesh, grant.pickup.kind as HeldKind);
              const i = scattered.items.indexOf(spawned);
              if (i >= 0) scattered.items.splice(i, 1);
              loot.onRemoved(spawned);
            }
          } else if (grant?.cook && player.heldKind === "fish") {
            player.inventory.relabelHeld("fishCooked");
          }
        }
      }

      survivorSend += dt;
      if (survivorSend >= 1 / SURVIVOR_HZ) {
        survivorSend = 0;
        persistSurvivor(true);
      }

      this.patchStores(session, needsStore, playerStore, inventoryStore, worldStore, ui, {
        day,
        needs,
        player,
        items: scattered.items,
        weather,
        livedSeconds,
        afk,
      });
      applyHealthLook(needs.health);
      const chips: PlayerChipState[] = [
        {
          object: player.mesh,
          name: character.name,
          afk,
          alive: player.alive,
          say: liveSay(localSay, localSayAt, now),
        },
      ];
      if (room) {
        for (const net of room.remotes) {
          const root = remotes.get(net.uid)?.visual?.root;
          if (!root) continue;
          chips.push({
            object: root,
            name: net.name,
            afk: Boolean(net.afk),
            alive: net.alive,
            say: net.afk ? null : liveSay(net.say, net.sayAt, now),
          });
        }
      }
      syncPlayerChips(chips, camera, renderer);
      renderer.render(scene, camera);
      if (needs.health <= 0) {
        dead = true;
        player.alive = false;
        afk = false;
        closeChat();
        syncPlayerChips([], camera, renderer);
        ui.dead = true;
        ui.deathHours = livedHoursFromSeconds(livedSeconds);
        document.body.classList.add("dead");
        applyHealthLook(0);
        persistSurvivor(false, ui.deathHours);
        return;
      }
      requestAnimationFrame(frame);
    };

    if (saved && !saved.alive) {
      dead = true;
      player.alive = false;
      needs.health = 0;
      ui.dead = true;
      ui.deathHours = saved.deathHours;
      document.body.classList.add("dead");
      applyHealthLook(0);
      persistSurvivor(false, saved.deathHours);
    } else {
      persistSurvivor(true);
    }

    frame();
  };

  private patchStores(
    session: ReturnType<typeof useSessionStore>,
    needsStore: ReturnType<typeof useNeedsStore>,
    playerStore: ReturnType<typeof usePlayerStore>,
    inventoryStore: ReturnType<typeof useInventoryStore>,
    worldStore: ReturnType<typeof useWorldStore>,
    ui: ReturnType<typeof useUiStore>,
    ctx: {
      day: DayClock;
      needs: Needs;
      player: GridPlayer;
      items: Item[];
      weather: Weather;
      livedSeconds: number;
      afk: boolean;
    },
  ): void {
    const snap = ctx.needs.snapshot();
    session.$patch({
      dayT: ctx.day.t,
      clock: ctx.day.clockLabel(),
      survivedHours: livedHoursFromSeconds(ctx.livedSeconds),
      alive: ctx.player.alive,
      afk: ctx.afk,
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
