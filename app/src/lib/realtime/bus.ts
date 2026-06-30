// Realtime bus: Postgres LISTEN/NOTIFY → fan-out tới buyer/seller đang mở tab (SSE).
// Cô lập toàn bộ ở file này để sau đổi sang Redis/managed không lan ra chỗ khác.
//
// 1 client pg riêng giữ mở chạy LISTEN order_channel (KHÔNG dùng query() của pool vì pool cấp
// connection khác nhau). repo gọi notifyOrder() TRONG transaction → NOTIFY chỉ phát khi COMMIT.

import type { PoolClient } from "pg";
import { pool, query, type TxQuery } from "@/lib/db";
import type { OrderStatus } from "@/lib/orders/types";

const CHANNEL = "order_channel";

export type OrderNotify = {
  orderId: number;
  status: OrderStatus;
  buyerId: number;
  restaurantId: number;
};

type Subscriber = (payload: OrderNotify) => void;

type BusState = {
  client: PoolClient | null;
  ready: Promise<void> | null;
  subscribers: Map<number, Set<Subscriber>>;
};

// Sống qua hot-reload của Next (dev) — như pool ở db.ts.
const globalForBus = globalThis as unknown as { __orderBus?: BusState };
const state: BusState =
  globalForBus.__orderBus ?? { client: null, ready: null, subscribers: new Map() };
globalForBus.__orderBus = state;

function teardown(): void {
  if (state.client) {
    try {
      state.client.release(true); // huỷ connection lỗi
    } catch {
      // bỏ qua
    }
    state.client = null;
  }
  state.ready = null;
  // còn người nghe → thử nối lại (backoff đơn giản).
  if (state.subscribers.size > 0) {
    setTimeout(() => void startListening(), 1000);
  }
}

async function connect(): Promise<void> {
  const client = await pool.connect();
  client.on("notification", (msg) => void handleNotify(msg.payload));
  client.on("error", () => teardown());
  await client.query(`LISTEN ${CHANNEL}`);
  state.client = client;
}

// Bảo đảm đang LISTEN; trả promise resolve khi sẵn sàng. Gọi nhiều lần an toàn.
export function startListening(): Promise<void> {
  if (state.client) return Promise.resolve();
  if (!state.ready) {
    state.ready = connect().catch((err) => {
      state.ready = null;
      throw err;
    });
  }
  return state.ready;
}

// Dừng LISTEN + giải phóng client (chủ yếu cho cleanup test).
export function stopListening(): void {
  if (state.client) {
    try {
      state.client.release(true);
    } catch {
      // bỏ qua
    }
    state.client = null;
  }
  state.ready = null;
}

// User quan tâm tới 1 event: buyer của đơn + owner của quán + mọi admin (admin xem được mọi đơn
// trên dashboard nên cũng cần tín hiệu realtime, dù không phải owner của quán).
async function interestedUsers(payload: OrderNotify): Promise<Set<number>> {
  const ids = new Set<number>([payload.buyerId]);
  const rows = await query<{ id: string }>(
    `SELECT user_id AS id FROM restaurant_owners WHERE restaurant_id = $1
     UNION
     SELECT id FROM users WHERE role = 'admin'`,
    [payload.restaurantId],
  );
  for (const r of rows) ids.add(Number(r.id));
  return ids;
}

async function handleNotify(raw?: string): Promise<void> {
  if (!raw) return;
  let payload: OrderNotify;
  try {
    payload = JSON.parse(raw) as OrderNotify;
  } catch {
    return; // payload hỏng → bỏ qua
  }
  if (state.subscribers.size === 0) return;

  const userIds = await interestedUsers(payload);
  for (const uid of userIds) {
    const set = state.subscribers.get(uid);
    if (!set) continue;
    for (const cb of set) {
      try {
        cb(payload);
      } catch {
        // lỗi 1 subscriber không ảnh hưởng người khác
      }
    }
  }
}

// Đăng ký nhận event của 1 user. Trả hàm huỷ đăng ký.
export function subscribe(userId: number, cb: Subscriber): () => void {
  let set = state.subscribers.get(userId);
  if (!set) {
    set = new Set();
    state.subscribers.set(userId, set);
  }
  set.add(cb);
  void startListening(); // lazy: nối LISTEN khi có người nghe đầu tiên

  return () => {
    const s = state.subscribers.get(userId);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) state.subscribers.delete(userId);
  };
}

// Phát tín hiệu trong transaction (repo gọi). NOTIFY chỉ tới khi COMMIT → nguyên tử với state change.
export async function notifyOrder(q: TxQuery, payload: OrderNotify): Promise<void> {
  await q(`SELECT pg_notify('${CHANNEL}', $1)`, [JSON.stringify(payload)]);
}
