import {
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

export type JoinResult =
  | { kind: "solo" }
  | { kind: "full" }
  | { kind: "joined"; room: Room };

type SlotRow = { uid: string; connectedAt: number };

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
    await set(ref(this.db, `rooms/${this.roomId}/players/${this.uid}`), player);
  }

  async publishWorld(world: NetWorld): Promise<void> {
    if (!this.isHost) return;
    await set(ref(this.db, `rooms/${this.roomId}/world`), world);
  }

  async sendIntent(intent: NetIntent): Promise<void> {
    await set(ref(this.db, `rooms/${this.roomId}/intents/${this.uid}`), intent);
  }

  async sendGrant(uid: string, grant: NetGrant): Promise<void> {
    if (!this.isHost) return;
    await set(ref(this.db, `rooms/${this.roomId}/grants/${uid}`), grant);
    await set(ref(this.db, `rooms/${this.roomId}/intents/${uid}`), null);
  }

  dispose(): void {
    for (const stop of this.unsubs) stop();
    this.unsubs = [];
  }
}

export async function joinRoom(): Promise<JoinResult> {
  if (!firebaseConfigured()) return { kind: "solo" };
  const fb = await connectFirebase();
  if (!fb?.auth.currentUser) return { kind: "solo" };
  const uid = fb.auth.currentUser.uid;
  const roomId = roomIdFromUrl();
  const slotsRef = ref(fb.db, `rooms/${roomId}/slots`);
  const tx = await runTransaction(slotsRef, (current: Record<string, SlotRow> | null) => {
    const slots = { ...(current ?? {}) };
    for (let i = 0; i < ROOM_SLOT_COUNT; i++) {
      if (slots[String(i)]?.uid === uid) return slots;
    }
    for (let i = 0; i < ROOM_SLOT_COUNT; i++) {
      if (!slots[String(i)]?.uid) {
        slots[String(i)] = { uid, connectedAt: Date.now() };
        return slots;
      }
    }
    return current;
  });
  const slots = (tx.snapshot.val() as Record<string, SlotRow> | null) ?? {};
  let slot = -1;
  for (let i = 0; i < ROOM_SLOT_COUNT; i++) {
    if (slots[String(i)]?.uid === uid) slot = i;
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
}
