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
  ROOM_SLOT_COUNT,
  roomIdFromUrl,
  type NetGrant,
  type NetIntent,
  type NetPlayer,
  type NetWorld,
} from "@/web/src/net/protocol";
import { parseSurvivor, type NetSurvivor } from "@/web/src/net/survivor";

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
  private world: NetWorld | null = null;
  private grant: NetGrant | null = null;
  private unsubs: Unsubscribe[] = [];

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
    return Object.values(this.players).filter((p) => p.uid !== this.uid);
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
        let best: { slot: number; uid: string } | null = null;
        for (let i = 0; i < ROOM_SLOT_COUNT; i++) {
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
    );
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
    try {
      await set(ref(this.db, `rooms/${this.roomId}/world`), toRtdb(world));
    } catch (err) {
      console.warn("publishWorld failed", err);
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
    let slot = -1;
    for (let i = 0; i < ROOM_SLOT_COUNT; i++) {
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
    if (slot < 0) return { kind: "full" };

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
