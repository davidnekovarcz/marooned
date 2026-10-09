<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { get, onValue, ref as dbRef, set, update, type Database, type Unsubscribe } from "firebase/database";
import { ADMIN_EMAIL } from "@/web/src/admin/access";
import {
  GROUND_CAP_MAX,
  builtinGroundCap,
  clampGroundCap,
  groundKindRank,
  visibleGroundKind,
} from "@/web/src/admin/ground";
import { formatIslandSurvival, sumStats } from "@/web/src/admin/metrics";
import { parseRooms, type PlayerRow, type RoomRecord } from "@/web/src/admin/records";
import { connectAdminFirebase } from "@/web/src/admin/session";
import { clampMaxPlayers, cleanRoomSlug, DEFAULT_MAX_PLAYERS } from "@/web/src/net/protocol";
import { playerRemovePaths, roomWipePaths } from "@/web/src/net/roomClear";
import { pragueDayKey } from "@/web/src/net/visits";
import IslandFull from "@/web/src/view/IslandFull.vue";

const ready = ref(false);
const configured = ref(true);
const user = ref<User | null>(null);
const denied = ref(false);
const note = ref("");
const roomRemoved = ref("");
const rooms = ref<RoomRecord[]>([]);
const roomQuery = ref("");
const selectedId = ref("");
const nameQuery = ref("");
const aliveFilter = ref<"all" | "alive" | "dead">("all");
const newSlug = ref("");
const newCap = ref(DEFAULT_MAX_PLAYERS);
const capDraft = ref(DEFAULT_MAX_PLAYERS);
const groundDrafts = ref<Record<string, string>>({});
let database: Database | null = null;
let stopAuth: Unsubscribe | null = null;
let stopRooms: Unsubscribe | null = null;
let keepEmpty = false;

watch(note, (value) => {
  if (value) roomRemoved.value = "";
});

const visibleRooms = computed(() => {
  const q = roomQuery.value.trim().toLowerCase();
  if (!q) return rooms.value;
  return rooms.value.filter((room) => room.id.includes(q));
});
const selected = computed(() => rooms.value.find((room) => room.id === selectedId.value) ?? null);
const gameStats = computed(() => sumStats(rooms.value.map((room) => room.stats)));
const itemGroups = computed(() => {
  const items = (selected.value?.items ?? []).filter((item) => visibleGroundKind(item.kind));
  const groups: { kind: string; count: number; items: typeof items }[] = [];
  for (const item of items) {
    let group = groups.find((row) => row.kind === item.kind);
    if (!group) {
      group = { kind: item.kind, count: 0, items: [] };
      groups.push(group);
    }
    group.items.push(item);
    if (item.state !== "waiting") group.count += 1;
  }
  groups.sort((a, b) => groundKindRank(a.kind) - groundKindRank(b.kind) || a.kind.localeCompare(b.kind));
  return groups;
});
const visiblePlayers = computed(() => {
  const room = selected.value;
  if (!room) return [];
  const q = nameQuery.value.trim().toLowerCase();
  return room.players.filter((player) => {
    if (q && !player.name.toLowerCase().includes(q)) return false;
    if (aliveFilter.value === "alive") return player.alive === true;
    if (aliveFilter.value === "dead") return player.alive === false;
    return true;
  });
});

function choose(id: string): void {
  keepEmpty = false;
  roomRemoved.value = "";
  selectedId.value = id;
  const room = rooms.value.find((row) => row.id === id);
  capDraft.value = room?.maxPlayers ?? DEFAULT_MAX_PLAYERS;
  const prefix = `${id}:`;
  const drafts: Record<string, string> = {};
  for (const [key, value] of Object.entries(groundDrafts.value)) {
    if (!key.startsWith(prefix)) drafts[key] = value;
  }
  groundDrafts.value = drafts;
}

function shownCap(kind: string): string {
  const room = selected.value;
  if (!room) return "";
  const draft = groundDrafts.value[`${room.id}:${kind}`];
  if (draft != null) return draft;
  const saved = room.groundCaps[kind];
  if (saved != null) return String(saved);
  const builtin = builtinGroundCap(kind);
  return builtin == null ? "" : String(builtin);
}

function setGroundDraft(kind: string, event: Event): void {
  const input = event.target;
  const room = selected.value;
  if (!(input instanceof HTMLInputElement) || !room) return;
  groundDrafts.value[`${room.id}:${kind}`] = input.value;
}

function listen(db: Database): void {
  stopRooms?.();
  stopRooms = onValue(dbRef(db, "rooms"), (snap) => {
    rooms.value = parseRooms(snap.val(), pragueDayKey(Date.now()));
    if (!selectedId.value && !keepEmpty && rooms.value[0]) choose(rooms.value[0].id);
    const current = rooms.value.find((room) => room.id === selectedId.value);
    if (current) capDraft.value = current.maxPlayers;
  });
}

async function signIn(): Promise<void> {
  note.value = "";
  try {
    const fb = await connectAdminFirebase();
    if (!fb) {
      note.value = "Firebase is not configured.";
      return;
    }
    await signInWithPopup(fb.auth, new GoogleAuthProvider());
  } catch (err) {
    note.value = err instanceof Error ? err.message : "Sign-in failed.";
  }
}

async function signOutAdmin(): Promise<void> {
  const fb = await connectAdminFirebase();
  if (!fb) return;
  await signOut(fb.auth);
}

async function createRoom(): Promise<void> {
  note.value = "";
  if (!database) return;
  const slug = cleanRoomSlug(newSlug.value);
  if (!slug) {
    note.value = "Use letters, digits, _ or -.";
    return;
  }
  const existing = await get(dbRef(database, `rooms/${slug}`));
  if (existing.exists()) {
    note.value = "That room already exists.";
    choose(slug);
    return;
  }
  const cap = clampMaxPlayers(Number(newCap.value));
  const now = Date.now();
  try {
    await set(dbRef(database, `rooms/${slug}/config/maxPlayers`), cap);
    await set(dbRef(database, `rooms/${slug}/config/createdAt`), now);
  } catch (err) {
    note.value = err instanceof Error ? err.message : "Could not create the room.";
    return;
  }
  newSlug.value = "";
  choose(slug);
  note.value = `Room ${slug} is ready. Open ?room=${slug} to play it.`;
}

async function saveCap(): Promise<void> {
  note.value = "";
  if (!database || !selected.value) return;
  const cap = clampMaxPlayers(Number(capDraft.value));
  try {
    await set(dbRef(database, `rooms/${selected.value.id}/config/maxPlayers`), cap);
  } catch (err) {
    note.value = err instanceof Error ? err.message : "Could not save the max.";
    return;
  }
  note.value = `${selected.value.id} now allows ${cap} players. People already inside stay.`;
}

async function saveGroundCap(kind: string): Promise<void> {
  note.value = "";
  if (!database || !selected.value || !visibleGroundKind(kind)) return;
  const cap = clampGroundCap(shownCap(kind));
  if (cap == null) {
    note.value = "Use a whole number from 0 to 40.";
    return;
  }
  const roomId = selected.value.id;
  try {
    await set(dbRef(database, `rooms/${roomId}/config/groundCaps/${kind}`), cap);
  } catch (err) {
    note.value = err instanceof Error ? err.message : "Could not save the ground max.";
    return;
  }
  const drafts = { ...groundDrafts.value };
  delete drafts[`${roomId}:${kind}`];
  groundDrafts.value = drafts;
  note.value = `${roomId} keeps at most ${cap} ${kind}. The host applies it the next time they are in the room.`;
}

async function clearRoomPaths(roomId: string, paths: string[]): Promise<void> {
  if (!database || !paths.length) return;
  const values: Record<string, null> = {};
  for (const path of paths) values[path] = null;
  await update(dbRef(database, `rooms/${roomId}`), values);
}

async function removePlayer(player: PlayerRow): Promise<void> {
  note.value = "";
  const roomId = selected.value?.id;
  if (!database || !roomId) return;
  const name = player.name || player.uid;
  if (!window.confirm(`Remove ${name} from ${roomId}?`)) return;
  try {
    const snap = await get(dbRef(database, `rooms/${roomId}`));
    const paths = playerRemovePaths(snap.val(), player.uid);
    if (!paths.length) {
      note.value = "Could not remove the player.";
      return;
    }
    await clearRoomPaths(roomId, paths);
    note.value = `Removed ${name}.`;
  } catch (err) {
    note.value = err instanceof Error ? err.message : "Could not remove the player.";
  }
}

async function removeRoom(): Promise<void> {
  note.value = "";
  const roomId = selected.value?.id;
  if (!database || !roomId) return;
  if (!window.confirm(`Remove room ${roomId}?`)) return;
  try {
    const snap = await get(dbRef(database, `rooms/${roomId}`));
    await clearRoomPaths(roomId, roomWipePaths(snap.val()));
    keepEmpty = true;
    selectedId.value = "";
    roomRemoved.value = `Removed room ${roomId}.`;
  } catch (err) {
    note.value = err instanceof Error ? err.message : "Could not remove the room.";
  }
}

async function forceRespawn(): Promise<void> {
  note.value = "";
  if (!database || !selected.value) return;
  try {
    await set(dbRef(database, `rooms/${selected.value.id}/commands/respawnItems`), Date.now());
  } catch (err) {
    note.value = err instanceof Error ? err.message : "Could not ask for a respawn.";
    return;
  }
  note.value = "Ground loot will respawn when the host is in the room. Pockets stay put.";
}

function aliveLabel(player: PlayerRow): string {
  if (player.alive === true) return "alive";
  if (player.alive === false) return "dead";
  return "away";
}

function when(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-GB", { timeZone: "Europe/Prague" });
}

onMounted(async () => {
  const fb = await connectAdminFirebase();
  if (!fb) {
    configured.value = false;
    ready.value = true;
    return;
  }
  database = fb.db;
  stopAuth = onAuthStateChanged(fb.auth, (next) => {
    user.value = next;
    const email = next?.email?.toLowerCase() ?? "";
    denied.value = Boolean(next && email !== ADMIN_EMAIL);
    ready.value = true;
    if (next && email === ADMIN_EMAIL) listen(fb.db);
    else stopRooms?.();
  });
});

onUnmounted(() => {
  stopAuth?.();
  stopRooms?.();
});
</script>

<template>
  <div class="lagoon">
    <svg class="palm palm-left" viewBox="0 0 140 240" aria-hidden="true">
      <path d="M78 240 C74 170 90 120 72 78" stroke="#4a3018" stroke-width="10" fill="none" stroke-linecap="round" />
      <ellipse cx="72" cy="70" rx="34" ry="12" fill="#1b5c38" transform="rotate(-40 72 70)" />
      <ellipse cx="72" cy="70" rx="34" ry="12" fill="#226b42" transform="rotate(-10 72 70)" />
      <ellipse cx="72" cy="70" rx="34" ry="12" fill="#1a5434" transform="rotate(25 72 70)" />
      <ellipse cx="72" cy="70" rx="30" ry="11" fill="#2d7a4a" transform="rotate(60 72 70)" />
    </svg>
    <svg class="palm palm-right" viewBox="0 0 140 240" aria-hidden="true">
      <path d="M62 240 C66 170 50 120 68 78" stroke="#4a3018" stroke-width="10" fill="none" stroke-linecap="round" />
      <ellipse cx="68" cy="70" rx="34" ry="12" fill="#1b5c38" transform="rotate(40 68 70)" />
      <ellipse cx="68" cy="70" rx="34" ry="12" fill="#226b42" transform="rotate(10 68 70)" />
      <ellipse cx="68" cy="70" rx="34" ry="12" fill="#1a5434" transform="rotate(-25 68 70)" />
      <ellipse cx="68" cy="70" rx="30" ry="11" fill="#2d7a4a" transform="rotate(-60 68 70)" />
    </svg>

    <IslandFull v-if="roomRemoved" :text="roomRemoved" />

    <main class="screen">
      <header class="screen-bar">
        <h1>Marooned</h1>
        <p v-if="user && !denied">{{ user.email }}</p>
        <button v-if="user" type="button" class="quiet" @click="signOutAdmin">Sign out</button>
      </header>

      <p v-if="!configured" class="gate-copy">Firebase is not configured in this build.</p>
      <p v-else-if="!ready" class="gate-copy">Checking sign-in…</p>
      <section v-else-if="!user" class="gate">
        <h2>Admin</h2>
        <p>Sign in to see the islands.</p>
        <button type="button" @click="signIn">Sign in with Google</button>
      </section>
      <section v-else-if="denied" class="gate">
        <p>{{ user.email }} cannot open admin.</p>
      </section>
      <div v-else class="workspace">
        <aside>
          <h2>Rooms</h2>
          <label>Filter <input v-model="roomQuery" type="search" /></label>
          <button
            v-for="room in visibleRooms"
            :key="room.id"
            type="button"
            class="room"
            :class="{ selected: room.id === selectedId }"
            @click="choose(room.id)"
          >
            <strong>{{ room.id }}</strong>
            <span>{{ room.online }} online · {{ room.stats.players }} players (total) · {{ room.maxPlayers }} max</span>
          </button>
          <h3>New room</h3>
          <label>Slug <input v-model="newSlug" type="text" maxlength="32" /></label>
          <label>Players <input v-model.number="newCap" type="number" min="1" max="10" /></label>
          <button type="button" @click="createRoom">Create room</button>
        </aside>

        <div class="main">
          <p v-if="note" class="note">{{ note }}</p>
          <section>
            <h2>Whole game</h2>
            <dl>
              <div><dt>Players played</dt><dd>{{ gameStats.players }}</dd></div>
              <div><dt>Players today</dt><dd>{{ gameStats.playersToday }}</dd></div>
              <div><dt>Survival</dt><dd>{{ formatIslandSurvival(gameStats.survivalSeconds) }}</dd></div>
              <div><dt>Survival today</dt><dd>{{ formatIslandSurvival(gameStats.survivalTodaySeconds) }}</dd></div>
              <div><dt>Most at once</dt><dd>{{ gameStats.peakPlayers }}</dd></div>
            </dl>
          </section>

          <section v-if="selected">
            <header class="room-head">
              <div>
                <h2>{{ selected.id }}</h2>
                <p>Created {{ when(selected.createdAt) }}</p>
              </div>
              <div class="cap">
                <label>Max <input v-model.number="capDraft" type="number" min="1" max="10" /></label>
                <button type="button" @click="saveCap">Save max</button>
                <button type="button" @click="forceRespawn">Respawn ground items</button>
                <button type="button" class="danger" @click="removeRoom">Remove room</button>
              </div>
            </header>
            <dl>
              <div><dt>Players played</dt><dd>{{ selected.stats.players }}</dd></div>
              <div><dt>Players today</dt><dd>{{ selected.stats.playersToday }}</dd></div>
              <div><dt>Survival</dt><dd>{{ formatIslandSurvival(selected.stats.survivalSeconds) }}</dd></div>
              <div><dt>Survival today</dt><dd>{{ formatIslandSurvival(selected.stats.survivalTodaySeconds) }}</dd></div>
              <div><dt>Most at once</dt><dd>{{ selected.stats.peakPlayers }}</dd></div>
            </dl>

            <h3>Players</h3>
            <div class="filters">
              <label>Name <input v-model="nameQuery" type="search" /></label>
              <label>
                State
                <select v-model="aliveFilter">
                  <option value="all">All</option>
                  <option value="alive">Alive</option>
                  <option value="dead">Dead</option>
                </select>
              </label>
            </div>
            <table>
              <thead>
                <tr><th>Name</th><th>State</th><th>Survival</th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="player in visiblePlayers" :key="player.uid">
                  <td>{{ player.name }}</td>
                  <td>{{ aliveLabel(player) }}</td>
                  <td>{{ formatIslandSurvival(player.livedSeconds) }}</td>
                  <td><button type="button" class="quiet danger" @click="removePlayer(player)">Remove</button></td>
                </tr>
              </tbody>
            </table>

            <details class="ground-fold">
              <summary>Ground items</summary>
              <section v-for="group in itemGroups" :key="group.kind" class="item-group">
                <header class="kind-head">
                  <h4>{{ group.kind }} <span class="kind-count">{{ group.count }}</span></h4>
                  <div class="cap">
                    <label>
                      Max
                      <input
                        :value="shownCap(group.kind)"
                        type="number"
                        min="0"
                        :max="GROUND_CAP_MAX"
                        step="1"
                        @input="setGroundDraft(group.kind, $event)"
                      />
                    </label>
                    <button type="button" @click="saveGroundCap(group.kind)">Save</button>
                  </div>
                </header>
                <table>
                  <thead>
                    <tr><th>Kind</th><th>Cell</th><th>State</th><th>Respawn</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, index) in group.items" :key="`${item.kind}-${item.cell}-${index}`">
                      <td>{{ item.kind }}</td>
                      <td>{{ item.cell }}</td>
                      <td>{{ item.state }}</td>
                      <td>{{ item.countdown }}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </details>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>
