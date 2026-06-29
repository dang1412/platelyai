// Lớp dữ liệu đơn hàng (mọi SQL tham số hoá $1,$2…, §3). Map DB → kiểu `Order` mà UI dùng.
// Giá món LẤY TỪ DB khi tạo đơn (không tin client). pg_notify để bus (task 05) fan-out realtime.

import { type QueryResultRow } from "pg";
import { query, withTransaction } from "@/lib/db";
import { ValidationError } from "@/lib/adminValidate";
import type { CurrentUser } from "@/lib/authz";
import type { CreateOrderInput } from "@/lib/orderValidate";
import { notifyOrder } from "@/lib/realtime/bus";
import type { Fulfillment, Order, OrderStatus } from "./types";

// Query bám pool hoặc transaction — cùng chữ ký nên dùng chung cho load.
type Q = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

// Thông tin tối thiểu để phân quyền/transition (KHÔNG lộ buyerId ra client).
export type OrderAuth = {
  id: number;
  buyerId: number;
  restaurantId: number;
  fulfillment: Fulfillment;
  status: OrderStatus;
};

type OrderRow = {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  fulfillment_type: Fulfillment;
  status: OrderStatus;
  buyer_phone: string;
  delivery_address: string | null;
  note: string | null;
  total_amount: number;
  created_at: Date;
};
type ItemRow = {
  order_id: string;
  name_snapshot: string;
  price_snapshot: number;
  quantity: number;
};
type EventRow = {
  order_id: string;
  status: OrderStatus;
  created_at: Date;
  note: string | null;
};

function iso(d: Date): string {
  return new Date(d).toISOString();
}

// Nạp danh sách đơn theo `whereSql` (chỉ chứa $n nội bộ, không nội suy value) + items/events gộp.
async function loadOrders(
  q: Q,
  whereSql: string,
  params: unknown[],
  orderBy = "o.created_at DESC",
): Promise<Order[]> {
  const orders = await q<OrderRow>(
    `SELECT o.id, o.restaurant_id, o.fulfillment_type, o.status, o.buyer_phone,
            o.delivery_address, o.note, o.total_amount, o.created_at,
            r.name AS restaurant_name
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
      WHERE ${whereSql}
      ORDER BY ${orderBy}`,
    params,
  );
  if (orders.length === 0) return [];

  const ids = orders.map((o) => Number(o.id));
  const items = await q<ItemRow>(
    `SELECT order_id, name_snapshot, price_snapshot, quantity
       FROM order_items WHERE order_id = ANY($1::bigint[]) ORDER BY id`,
    [ids],
  );
  const events = await q<EventRow>(
    `SELECT order_id, status, created_at, note
       FROM order_events WHERE order_id = ANY($1::bigint[]) ORDER BY created_at, id`,
    [ids],
  );

  return orders.map((o) => ({
    id: String(o.id),
    restaurantId: String(o.restaurant_id),
    restaurantName: o.restaurant_name,
    fulfillment: o.fulfillment_type,
    status: o.status,
    items: items
      .filter((it) => it.order_id === o.id)
      .map((it) => ({
        name: it.name_snapshot,
        price: it.price_snapshot,
        quantity: it.quantity,
      })),
    total: o.total_amount,
    phone: o.buyer_phone,
    address: o.delivery_address,
    note: o.note,
    events: events
      .filter((e) => e.order_id === o.id)
      .map((e) => ({ status: e.status, at: iso(e.created_at), note: e.note ?? undefined })),
    createdAt: iso(o.created_at),
  }));
}

export async function getOrderFull(id: number): Promise<Order | null> {
  const [order] = await loadOrders(query, "o.id = $1", [id]);
  return order ?? null;
}

export async function getOrderAuth(id: number): Promise<OrderAuth | null> {
  const [row] = await query<{
    id: string;
    buyer_id: string;
    restaurant_id: string;
    fulfillment_type: Fulfillment;
    status: OrderStatus;
  }>(
    `SELECT id, buyer_id, restaurant_id, fulfillment_type, status
       FROM orders WHERE id = $1`,
    [id],
  );
  if (!row) return null;
  return {
    id: Number(row.id),
    buyerId: Number(row.buyer_id),
    restaurantId: Number(row.restaurant_id),
    fulfillment: row.fulfillment_type,
    status: row.status,
  };
}

export function listOrdersForBuyer(buyerId: number): Promise<Order[]> {
  return loadOrders(query, "o.buyer_id = $1", [buyerId]);
}

// Đơn của các quán seller quản lý (admin: tất cả). Lọc theo 1 quán nếu truyền restaurantId.
export function listOrdersForSeller(
  user: CurrentUser,
  restaurantId?: number,
): Promise<Order[]> {
  if (user.role === "user") return Promise.resolve([]);
  const params: unknown[] = [];
  let where: string;
  if (user.role === "owner") {
    params.push(user.id);
    where = `o.restaurant_id IN (SELECT restaurant_id FROM restaurant_owners WHERE user_id = $${params.length})`;
  } else {
    where = "TRUE"; // admin
  }
  if (restaurantId != null) {
    params.push(restaurantId);
    where += ` AND o.restaurant_id = $${params.length}`;
  }
  return loadOrders(query, where, params);
}

export async function pendingCountForSeller(user: CurrentUser): Promise<number> {
  if (user.role === "user") return 0;
  if (user.role === "admin") {
    const [r] = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM orders WHERE status = 'pending'`,
    );
    return Number(r.n);
  }
  const [r] = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM orders
      WHERE status = 'pending'
        AND restaurant_id IN (SELECT restaurant_id FROM restaurant_owners WHERE user_id = $1)`,
    [user.id],
  );
  return Number(r.n);
}

export async function createOrder(
  buyerId: number,
  input: CreateOrderInput,
): Promise<Order> {
  return withTransaction(async (q) => {
    const ids = input.items.map((it) => it.menuItemId);
    const menu = await q<{
      id: string;
      name: string;
      price: number | null;
      restaurant_id: string;
      is_available: boolean | null;
    }>(
      `SELECT id, name, price, restaurant_id, is_available
         FROM menu_items WHERE id = ANY($1::bigint[])`,
      [ids],
    );
    const byId = new Map(menu.map((m) => [Number(m.id), m]));

    for (const it of input.items) {
      const m = byId.get(it.menuItemId);
      if (!m) throw new ValidationError(`Món ${it.menuItemId} không tồn tại`);
      if (Number(m.restaurant_id) !== input.restaurantId) {
        throw new ValidationError("Món không thuộc quán này");
      }
      if (m.is_available === false) {
        throw new ValidationError(`Món "${m.name}" hiện không bán`);
      }
      if (m.price == null) {
        throw new ValidationError(`Món "${m.name}" chưa có giá`);
      }
    }

    const total = input.items.reduce(
      (s, it) => s + Number(byId.get(it.menuItemId)!.price) * it.quantity,
      0,
    );

    const [created] = await q<{ id: string }>(
      `INSERT INTO orders
         (buyer_id, restaurant_id, fulfillment_type, buyer_phone,
          delivery_address, delivery_lat, delivery_lng, delivery_location,
          note, total_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,
         CASE WHEN $6::double precision IS NULL OR $7::double precision IS NULL THEN NULL
              ELSE ST_SetSRID(ST_MakePoint($7,$6),4326)::geography END,
         $8,$9)
       RETURNING id`,
      [
        buyerId,
        input.restaurantId,
        input.fulfillment,
        input.phone,
        input.address,
        input.lat,
        input.lng,
        input.note,
        total,
      ],
    );
    const orderId = Number(created.id);

    for (const it of input.items) {
      const m = byId.get(it.menuItemId)!;
      await q(
        `INSERT INTO order_items (order_id, menu_item_id, name_snapshot, price_snapshot, quantity)
         VALUES ($1,$2,$3,$4,$5)`,
        [orderId, it.menuItemId, m.name, m.price, it.quantity],
      );
    }
    await q(
      `INSERT INTO order_events (order_id, status, actor_id) VALUES ($1,'pending',$2)`,
      [orderId, buyerId],
    );
    await notifyOrder(q, {
      orderId,
      status: "pending",
      buyerId,
      restaurantId: input.restaurantId,
    });

    const [order] = await loadOrders(q, "o.id = $1", [orderId]);
    return order;
  });
}

export async function advanceStatus(
  order: OrderAuth,
  toStatus: OrderStatus,
  actorId: number,
  note?: string,
): Promise<Order> {
  return withTransaction(async (q) => {
    await q(`UPDATE orders SET status = $1, updated_at = now() WHERE id = $2`, [
      toStatus,
      order.id,
    ]);
    await q(
      `INSERT INTO order_events (order_id, status, actor_id, note) VALUES ($1,$2,$3,$4)`,
      [order.id, toStatus, actorId, note ?? null],
    );
    await notifyOrder(q, {
      orderId: order.id,
      status: toStatus,
      buyerId: order.buyerId,
      restaurantId: order.restaurantId,
    });
    const [updated] = await loadOrders(q, "o.id = $1", [order.id]);
    return updated;
  });
}
