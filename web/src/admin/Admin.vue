<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { get, onValue, ref as dbRef, set, type Database, type Unsubscribe } from "firebase/database";
import { ADMIN_EMAIL } from "@/web/src/admin/access";
import { formatIslandSurvival, sumStats } from "@/web/src/admin/metrics";
import { parseRooms, type PlayerRow, type RoomRecord } from "@/web/src/admin/records";
import { connectAdminFirebase } from "@/web/src/admin/session";
import { clampMaxPlayers, cleanRoomSlug } from "@/web/src/net/protocol";
import { pragueDayKey } from "@/web/src/net/visits";

const ready = ref(false);
const configured = ref(true);
const user = ref<User | null>(null);
const denied = ref(false);
const note = ref("");
const rooms = ref<RoomRecord[]>([]);
const roomQuery = ref("");
const selectedId = ref("");
const nameQuery = ref("");
const aliveFilter = ref<"all" | "alive" | "dead">("all");
const newSlug = ref("");
const newCap = ref(4);
const capDraft = ref(4);
let database: Database | null = null;
let stopAuth: Unsubscribe | null = null;
let stopRooms: Unsubscribe | null = null;

const visibleRooms = computed(() => {
  const q = roomQuery.value.trim().toLowerCase();
  if (!q) return rooms.value;
  return rooms.value.filter((room) => room.id.includes(q));
});
const selected = computed(() => rooms.value.find((room) => room.id === selectedId.value) ?? null);
const gameStats = computed(() => sumStats(rooms.value.map((room) => room.stats)));
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
  selectedId.value = id;
  const room = rooms.value.find((row) => row.id === id);
  capDraft.value = room?.maxPlayers ?? 4;
}

function listen(db: Database): void {
  stopRooms?.();
  stopRooms = onValue(dbRef(db, "rooms"), (snap) => {
    rooms.value = parseRooms(snap.val(), pragueDayKey(Date.now()));
    if (!selectedId.value && rooms.value[0]) choose(rooms.value[0].id);
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
    note.value = err instanceof Error ? err.message : "Could not save the cap.";
    return;
  }
  note.value = `${selected.value.id} now allows ${cap} players. People already inside stay.`;
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
  <main class="admin">
    <header>
      <h1>Marooned admin</h1>
      <p v-if="user && !denied">{{ user.email }}</p>
    </header>

    <p v-if="!configured">Firebase is not configured in this build.</p>
    <p v-else-if="!ready">Checking sign-in…</p>
    <section v-else-if="!user">
      <button type="button" @click="signIn">Sign in with Google</button>
    </section>
    <section v-else-if="denied">
      <p>{{ user.email }} cannot open admin.</p>
      <button type="button" @click="signOutAdmin">Sign out</button>
    </section>
    <template v-else>
      <section class="stats">
        <h2>Whole game</h2>
        <dl>
          <div><dt>Players played</dt><dd>{{ gameStats.players }}</dd></div>
          <div><dt>Players today</dt><dd>{{ gameStats.playersToday }}</dd></div>
          <div><dt>Survival</dt><dd>{{ formatIslandSurvival(gameStats.survivalSeconds) }}</dd></div>
          <div><dt>Survival today</dt><dd>{{ formatIslandSurvival(gameStats.survivalTodaySeconds) }}</dd></div>
          <div><dt>Most at once</dt><dd>{{ gameStats.peakPlayers }}</dd></div>
        </dl>
      </section>

      <section class="create">
        <h2>New room</h2>
        <label>Slug <input v-model="newSlug" type="text" maxlength="32" /></label>
        <label>Players <input v-model.number="newCap" type="number" min="1" max="16" /></label>
        <button type="button" @click="createRoom">Create room</button>
      </section>
      <p v-if="note" class="note">{{ note }}</p>

      <section class="rooms">
        <h2>Rooms</h2>
        <label>Filter <input v-model="roomQuery" type="search" /></label>
        <table>
          <thead>
            <tr><th>Room</th><th>Online</th><th>Cap</th><th>Created</th></tr>
          </thead>
          <tbody>
            <tr
              v-for="room in visibleRooms"
              :key="room.id"
              :class="{ selected: room.id === selectedId }"
              @click="choose(room.id)"
            >
              <td>{{ room.id }}</td>
              <td>{{ room.online }}</td>
              <td>{{ room.maxPlayers }}</td>
              <td>{{ when(room.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="selected">
        <h2>{{ selected.id }}</h2>
        <dl>
          <div><dt>Players played</dt><dd>{{ selected.stats.players }}</dd></div>
          <div><dt>Players today</dt><dd>{{ selected.stats.playersToday }}</dd></div>
          <div><dt>Survival</dt><dd>{{ formatIslandSurvival(selected.stats.survivalSeconds) }}</dd></div>
          <div><dt>Survival today</dt><dd>{{ formatIslandSurvival(selected.stats.survivalTodaySeconds) }}</dd></div>
          <div><dt>Most at once</dt><dd>{{ selected.stats.peakPlayers }}</dd></div>
        </dl>
        <label>Player cap <input v-model.number="capDraft" type="number" min="1" max="16" /></label>
        <button type="button" @click="saveCap">Save cap</button>
        <button type="button" @click="forceRespawn">Respawn ground items</button>

        <h3>Players</h3>
        <label>Name <input v-model="nameQuery" type="search" /></label>
        <label>
          State
          <select v-model="aliveFilter">
            <option value="all">All</option>
            <option value="alive">Alive</option>
            <option value="dead">Dead</option>
          </select>
        </label>
        <table>
          <thead>
            <tr><th>Name</th><th>State</th><th>Survival</th></tr>
          </thead>
          <tbody>
            <tr v-for="player in visiblePlayers" :key="player.uid">
              <td>{{ player.name }}</td>
              <td>{{ aliveLabel(player) }}</td>
              <td>{{ formatIslandSurvival(player.livedSeconds) }}</td>
            </tr>
          </tbody>
        </table>

        <h3>Ground items</h3>
        <table>
          <thead>
            <tr><th>Kind</th><th>Cell</th><th>State</th><th>Respawn</th></tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in selected.items" :key="`${item.kind}-${index}`">
              <td>{{ item.kind }}</td>
              <td>{{ item.cell }}</td>
              <td>{{ item.state }}</td>
              <td>{{ item.countdown }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </main>
</template>
