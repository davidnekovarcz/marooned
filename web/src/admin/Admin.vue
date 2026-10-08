<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { get, onValue, ref as dbRef, set, type Database, type Unsubscribe } from "firebase/database";
import { ADMIN_EMAIL } from "@/web/src/admin/access";
import { GROUND_CATEGORIES, groundCategoryLabel, type GroundCategory } from "@/web/src/admin/ground";
import { formatIslandSurvival, sumStats } from "@/web/src/admin/metrics";
import { parseRooms, type PlayerRow, type RoomRecord } from "@/web/src/admin/records";
import { connectAdminFirebase } from "@/web/src/admin/session";
import { clampMaxPlayers, cleanRoomSlug, DEFAULT_MAX_PLAYERS } from "@/web/src/net/protocol";
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
const newCap = ref(DEFAULT_MAX_PLAYERS);
const capDraft = ref(DEFAULT_MAX_PLAYERS);
const categoryFilter = ref<"all" | GroundCategory>("all");
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
const itemGroups = computed(() => {
  const items = selected.value?.items ?? [];
  return GROUND_CATEGORIES.filter(
    (category) => categoryFilter.value === "all" || categoryFilter.value === category,
  )
    .map((category) => ({
      category,
      label: groundCategoryLabel(category),
      items: items.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);
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
  selectedId.value = id;
  const room = rooms.value.find((row) => row.id === id);
  capDraft.value = room?.maxPlayers ?? DEFAULT_MAX_PLAYERS;
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
    note.value = err instanceof Error ? err.message : "Could not save the max.";
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
            <span>{{ room.online }} online · max {{ room.maxPlayers }} · {{ room.stats.players }} players</span>
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

            <details class="ground-fold">
              <summary>Ground items</summary>
              <label>
                Category
                <select v-model="categoryFilter">
                  <option value="all">All</option>
                  <option v-for="category in GROUND_CATEGORIES" :key="category" :value="category">
                    {{ groundCategoryLabel(category) }}
                  </option>
                </select>
              </label>
              <section v-for="group in itemGroups" :key="group.category" class="item-group">
                <h4>{{ group.label }}</h4>
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
