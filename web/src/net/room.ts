import {
  get,
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  set,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import { connectFirebase, firebaseConfigured } from "@/web/src/net/firebase";
import {
  clampMaxPlayers,
  MAX_PLAYERS_LIMIT,
  roomIdFromUrl,
  type NetGrant,
  type NetIntent,
  type NetPlayer,
  type NetWorld,
} from "@/web/src/net/protocol";
import { parseSurvivor, type NetSurvivor } from "@/web/src/net/survivor";
import { nextVisit, parseVisit } from "@/web/src/net/visits";

export type JoinResult =
  | { kind: "solo" }
  | { kind: "full" }
  | { kind: "joined"; room: Room };

type SlotRow = { uid: string; connectedAt: number };

function toRtdb<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class Room {
  hostUid: string | null = null;
  private players: Record<string, NetPlayer> = {};
  private intents: Record<string, NetIntent> = {};
  private slots: Record<string, SlotRow> = {};
  private world: NetWorld | null = null;
  private grant: NetGrant | null = null;
  private unsubs: Unsubscribe[] = [];
  private lastPruneAt = 0;
  private respawnAt: number | null = null;
  private peakSent = 0;

  constructor(
    readonly db: Database,
    readonly roomId: string,
    readonly uid: string,
    readonly slot: number,
  ) {}

  get isHost(): boolean {
    return this.hostUid === this.uid;
  }

  get remotes(): NetPlayer[] {
    const live = new Set<string>();
    for (const row of Object.values(this.slots)) {
      if (row?.uid) live.add(row.uid);
    }
    return Object.values(this.players).filter((p) => p.uid !== this.uid && live.has(p.uid));
  }

  latestWorld(): NetWorld | null {
    return this.world;
  }

  consumeGrant(): NetGrant | null {
    const next = this.grant;
    this.grant = null;
    return next;
  }

  consumeIntents(): NetIntent[] {
    const rows = Object.values(this.intents);
    this.intents = {};
    return rows;
  }

  listen(): void {
    const base = `rooms/${this.roomId}`;
    this.unsubs.push(
      onValue(ref(this.db, `${base}/slots`), (snap) => {
        const slots = (snap.val() as Record<string, SlotRow> | null) ?? {};
        this.slots = slots;
        let best: { slot: number; uid: string } | null = null;
        for (let i = 0; i < MAX_PLAYERS_LIMIT; i++) {
          const row = slots[String(i)];
          if (!row?.uid) continue;
          if (!best || i < best.slot) best = { slot: i, uid: row.uid };
        }
        this.hostUid = best?.uid ?? null;
        if (this.isHost) void set(ref(this.db, `${base}/host`), this.uid);
      }),
      onValue(ref(this.db, `${base}/players`), (snap) => {
        this.players = (snap.val() as Record<string, NetPlayer> | null) ?? {};
      }),
      onValue(ref(this.db, `${base}/world`), (snap) => {
        this.world = (snap.val() as NetWorld | null) ?? null;
      }),
      onValue(ref(this.db, `${base}/intents`), (snap) => {
        this.intents = (snap.val() as Record<string, NetIntent> | null) ?? {};
      }),
      onValue(ref(this.db, `${base}/grants/${this.uid}`), (snap) => {
        this.grant = (snap.val() as NetGrant | null) ?? null;
      }),
      onValue(ref(this.db, `${base}/commands/respawnItems`), (snap) => {
        const at = snap.val();
        this.respawnAt = typeof at === "number" && Number.isFinite(at) ? at : null;
      }),
    );
  }

  onlineCount(): number {
    let n = 0;
    for (const row of Object.values(this.slots)) {
      if (row?.uid) n += 1;
    }
    return n;
  }

  peekRespawnCommand(): number | null {
    return this.respawnAt;
  }

  async clearRespawnCommand(): Promise<void> {
    if (!this.isHost) return;
    try {
      await set(ref(this.db, `rooms/${this.roomId}/commands/respawnItems`), null);
      this.respawnAt = null;
    } catch (err) {
      console.warn("clearRespawnCommand failed", err);
    }
  }

  async raisePeak(count: number): Promise<void> {
    if (!this.isHost || count <= this.peakSent) return;
    this.peakSent = count;
    try {
      const peakRef = ref(this.db, `rooms/${this.roomId}/stats/peakPlayers`);
      const tx = await runTransaction(peakRef, (current: number | null) => {
        const prev = typeof current === "number" && Number.isFinite(current) ? current : 0;
        return Math.max(prev, count);
      });
      const saved = tx.snapshot.val();
      if (typeof saved === "number" && saved > this.peakSent) this.peakSent = saved;
    } catch (err) {
      this.peakSent = 0;
      console.warn("raisePeak failed", err);
    }
  }

  /** Drop player/intent rows whose uid is no longer holding a slot (failed onDisconnect leftovers). */
  async pruneOrphans(now = Date.now()): Promise<void> {
    if (!this.isHost) return;
    if (now - this.lastPruneAt < 2000) return;
    this.lastPruneAt = now;
    const live = new Set<string>();
    for (const row of Object.values(this.slots)) {
      if (row?.uid) live.add(row.uid);
    }
    const jobs: Promise<unknown>[] = [];
    for (const uid of Object.keys(this.players)) {
      if (live.has(uid)) continue;
      jobs.push(set(ref(this.db, `rooms/${this.roomId}/players/${uid}`), null));
    }
    for (const uid of Object.keys(this.intents)) {
      if (live.has(uid)) continue;
      jobs.push(set(ref(this.db, `rooms/${this.roomId}/intents/${uid}`), null));
    }
    if (!jobs.length) return;
    try {
      await Promise.all(jobs);
    } catch (err) {
      console.warn("pruneOrphans failed", err);
    }
  }

  /** One-shot host cleanup by display name (stale ghosts, including slot holders). */
  async removeGhostsByName(names: string[]): Promise<number> {
    if (!this.isHost || !names.length) return 0;
    const want = new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean));
    const uids = new Set<string>();
    for (const [uid, player] of Object.entries(this.players)) {
      if (want.has((player.name ?? "").trim().toLowerCase())) uids.add(uid);
    }
    if (!uids.size) return 0;
    const jobs: Promise<unknown>[] = [];
    for (const uid of uids) {
      jobs.push(set(ref(this.db, `rooms/${this.roomId}/players/${uid}`), null));
      jobs.push(set(ref(this.db, `rooms/${this.roomId}/intents/${uid}`), null));
      jobs.push(set(ref(this.db, `rooms/${this.roomId}/survivors/${uid}`), null));
      jobs.push(set(ref(this.db, `rooms/${this.roomId}/grants/${uid}`), null));
    }
    for (const [slot, row] of Object.entries(this.slots)) {
      if (row?.uid && uids.has(row.uid)) {
        jobs.push(set(ref(this.db, `rooms/${this.roomId}/slots/${slot}`), null));
      }
    }
    try {
      await Promise.all(jobs);
      return uids.size;
    } catch (err) {
      console.warn("removeGhostsByName failed", err);
      return 0;
    }
  }

  async publishPlayer(player: NetPlayer): Promise<void> {
    try {
      await set(ref(this.db, `rooms/${this.roomId}/players/${this.uid}`), toRtdb(player));
    } catch (err) {
      console.warn("publishPlayer failed", err);
    }
  }

  async publishWorld(world: NetWorld): Promise<void> {
    if (!this.isHost) return;
    const payload = toRtdb(world);
    try {
      await set(ref(this.db, `rooms/${this.roomId}/world`), payload);
    } catch (err) {
      console.warn("publishWorld failed", err);
      try {
        const base = `rooms/${this.roomId}/world`;
        await set(ref(this.db, `${base}/elapsed`), payload.elapsed);
        await set(ref(this.db, `${base}/dayT`), payload.dayT);
        await set(ref(this.db, `${base}/weather`), payload.weather);
        await set(ref(this.db, `${base}/hearths`), payload.hearths ?? []);
        await set(ref(this.db, `${base}/shelters`), payload.shelters ?? []);
        await set(ref(this.db, `${base}/items`), payload.items ?? []);
        if (payload.loot) await set(ref(this.db, `${base}/loot`), payload.loot);
      } catch (chunkErr) {
        console.warn("publishWorld chunked failed", chunkErr);
      }
    }
  }

  async sendIntent(intent: NetIntent): Promise<void> {
    try {
      await set(ref(this.db, `rooms/${this.roomId}/intents/${this.uid}`), toRtdb(intent));
    } catch (err) {
      console.warn("sendIntent failed", err);
    }
  }

  async sendGrant(uid: string, grant: NetGrant): Promise<void> {
    if (!this.isHost) return;
    try {
      await set(ref(this.db, `rooms/${this.roomId}/grants/${uid}`), toRtdb(grant));
      await set(ref(this.db, `rooms/${this.roomId}/intents/${uid}`), null);
    } catch (err) {
      console.warn("sendGrant failed", err);
    }
  }

  async clearIntent(uid: string): Promise<void> {
    if (!this.isHost) return;
    try {
      await set(ref(this.db, `rooms/${this.roomId}/intents/${uid}`), null);
    } catch (err) {
      console.warn("clearIntent failed", err);
    }
  }

  async loadWorld(): Promise<NetWorld | null> {
    try {
      const snap = await get(ref(this.db, `rooms/${this.roomId}/world`));
      const val = snap.val() as NetWorld | null;
      if (!val || typeof val !== "object") return null;
      const elapsedOk = typeof val.elapsed === "number" && Number.isFinite(val.elapsed);
      const dayOk = typeof val.dayT === "number" && Number.isFinite(val.dayT);
      if (!elapsedOk && !dayOk && val.items == null && !val.weather) return null;
      this.world = val;
      return val;
    } catch (err) {
      console.warn("loadWorld failed", err);
      return null;
    }
  }

  async loadSurvivor(): Promise<NetSurvivor | null> {
    try {
      const snap = await get(ref(this.db, `rooms/${this.roomId}/survivors/${this.uid}`));
      return parseSurvivor(snap.val());
    } catch (err) {
      console.warn("loadSurvivor failed", err);
      return null;
    }
  }

  async saveSurvivor(row: NetSurvivor): Promise<void> {
    try {
      await set(ref(this.db, `rooms/${this.roomId}/survivors/${this.uid}`), toRtdb(row));
      const visitRef = ref(this.db, `rooms/${this.roomId}/visits/${this.uid}`);
      const prev = parseVisit((await get(visitRef)).val());
      const now = row.updatedAt || Date.now();
      await set(visitRef, toRtdb(nextVisit(prev, row.livedSeconds, row.character.name, now)));
    } catch (err) {
      console.warn("saveSurvivor failed", err);
    }
  }

  dispose(): void {
    for (const stop of this.unsubs) stop();
    this.unsubs = [];
  }
}

export async function joinRoom(): Promise<JoinResult> {
  if (!firebaseConfigured()) return { kind: "solo" };
  try {
    const fb = await connectFirebase();
    if (!fb?.auth.currentUser) return { kind: "solo" };
    const uid = fb.auth.currentUser.uid;
    const roomId = roomIdFromUrl();
    const cap = clampMaxPlayers((await get(ref(fb.db, `rooms/${roomId}/config/maxPlayers`))).val());
    const held = ((await get(ref(fb.db, `rooms/${roomId}/slots`))).val() as Record<string, SlotRow> | null) ?? {};
    let slot = -1;
    let occupied = 0;
    for (let i = 0; i < MAX_PLAYERS_LIMIT; i++) {
      const row = held[String(i)];
      if (!row?.uid) continue;
      occupied += 1;
      if (row.uid === uid) slot = i;
    }
    if (slot < 0 && occupied >= cap) return { kind: "full" };
    if (slot < 0) {
      for (let i = 0; i < cap; i++) {
        const slotRef = ref(fb.db, `rooms/${roomId}/slots/${i}`);
        const tx = await runTransaction(slotRef, (current: SlotRow | null) => {
          if (current?.uid && current.uid !== uid) return;
          return { uid, connectedAt: Date.now() };
        });
        if (tx.committed && (tx.snapshot.val() as SlotRow | null)?.uid === uid) {
          slot = i;
          break;
        }
      }
    } else {
      await set(ref(fb.db, `rooms/${roomId}/slots/${slot}`), { uid, connectedAt: Date.now() });
    }
    if (slot < 0) return { kind: "full" };
    try {
      const createdRef = ref(fb.db, `rooms/${roomId}/config/createdAt`);
      if (typeof (await get(createdRef)).val() !== "number") {
        await runTransaction(createdRef, (current: number | null) => {
          if (typeof current === "number") return current;
          return Date.now();
        });
      }
    } catch (err) {
      console.warn("createdAt", err);
    }

    const room = new Room(fb.db, roomId, uid, slot);
    const slotRef = ref(fb.db, `rooms/${roomId}/slots/${slot}`);
    const playerRef = ref(fb.db, `rooms/${roomId}/players/${uid}`);
    const intentRef = ref(fb.db, `rooms/${roomId}/intents/${uid}`);
    await onDisconnect(slotRef).remove();
    await onDisconnect(playerRef).remove();
    await onDisconnect(intentRef).remove();
    if (slot === 0) await set(ref(fb.db, `rooms/${roomId}/host`), uid);
    room.listen();
    return { kind: "joined", room };
  } catch (err) {
    console.warn("joinRoom failed", err);
    return { kind: "solo" };
  }
}
