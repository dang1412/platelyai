import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query, pool } from "@/lib/db";
import { ValidationError } from "@/lib/adminValidate";
import type { CurrentUser } from "@/lib/authz";
import {
  createOrder,
  advanceStatus,
  getOrderAuth,
  listOrdersForSeller,
  sellerOrderCounts,
} from "./repo";

// Lưu ý: KHÔNG import @/lib/orders/authz ở đây — nó kéo @/lib/authz → @/auth (next-auth) vốn
// không nạp được dưới vitest. Logic guard (canTransition/allowedActors) đã phủ ở state.test.ts;
// canViewOrder/assertCanAct verify thủ công ở task 09 (cần auth + ownership thật).

// Integration test chạm Postgres thật (AGENTS §6). Tự tạo buyer/owner/quán/món ở toạ độ (0,0)
// (cô lập khỏi data thật) rồi dọn ở afterAll. Bỏ qua nếu không có DATABASE_URL.
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("orders repo (DB thật)", () => {
  const tag = `__test_orders_${Date.now()}`;
  let buyer: CurrentUser;
  let owner: CurrentUser;
  let other: CurrentUser;
  let restaurantId: number;
  let m1: number; // 45000
  let m2: number; // 30000

  async function mkUser(role: CurrentUser["role"], key: string): Promise<CurrentUser> {
    const [u] = await query<{ id: string }>(
      `INSERT INTO users (email, name, role) VALUES ($1,$2,$3) RETURNING id`,
      [`${tag}_${key}@x.test`, `${key}`, role],
    );
    return { id: Number(u.id), email: `${key}`, name: null, role };
  }

  beforeAll(async () => {
    buyer = await mkUser("user", "buyer");
    owner = await mkUser("owner", "owner");
    other = await mkUser("owner", "other");

    const [r] = await query<{ id: string }>(
      `INSERT INTO restaurants (name, location, lat, lng)
       VALUES ($1, ST_MakePoint(0,0)::geography, 0, 0) RETURNING id`,
      [tag],
    );
    restaurantId = Number(r.id);
    await query(
      `INSERT INTO restaurant_owners (restaurant_id, user_id) VALUES ($1,$2)`,
      [restaurantId, owner.id],
    );

    const [i1] = await query<{ id: string }>(
      `INSERT INTO menu_items (restaurant_id, name, price) VALUES ($1,'Bún chả',45000) RETURNING id`,
      [restaurantId],
    );
    m1 = Number(i1.id);
    const [i2] = await query<{ id: string }>(
      `INSERT INTO menu_items (restaurant_id, name, price) VALUES ($1,'Nem rán',30000) RETURNING id`,
      [restaurantId],
    );
    m2 = Number(i2.id);
  });

  afterAll(async () => {
    if (restaurantId) {
      await query(`DELETE FROM orders WHERE restaurant_id = $1`, [restaurantId]);
      await query(`DELETE FROM restaurant_owners WHERE restaurant_id = $1`, [restaurantId]);
      await query(`DELETE FROM menu_items WHERE restaurant_id = $1`, [restaurantId]);
      await query(`DELETE FROM restaurants WHERE id = $1`, [restaurantId]);
    }
    for (const u of [buyer, owner, other]) {
      if (u?.id) await query(`DELETE FROM users WHERE id = $1`, [u.id]);
    }
    await pool.end();
  });

  it("createOrder: total + snapshot giá lấy từ DB, event pending", async () => {
    const order = await createOrder(buyer.id, {
      restaurantId,
      fulfillment: "pickup",
      items: [
        { menuItemId: m1, quantity: 2 },
        { menuItemId: m2, quantity: 1 },
      ],
      phone: "0901234567",
      address: null,
      lat: null,
      lng: null,
      note: null,
    });
    expect(order.total).toBe(45000 * 2 + 30000); // 120000
    expect(order.restaurantId).toBe(String(restaurantId));
    expect(order.status).toBe("pending");
    expect(order.items).toHaveLength(2);
    expect(order.items.find((i) => i.name === "Bún chả")?.price).toBe(45000);
    expect(order.events.map((e) => e.status)).toEqual(["pending"]);
  });

  it("createOrder: chặn món không thuộc quán / không tồn tại", async () => {
    await expect(
      createOrder(buyer.id, {
        restaurantId,
        fulfillment: "pickup",
        items: [{ menuItemId: 999999999, quantity: 1 }],
        phone: "0901234567",
        address: null,
        lat: null,
        lng: null,
        note: null,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("advanceStatus: chuỗi pickup accepted → ready → completed, event append", async () => {
    const order = await createOrder(buyer.id, {
      restaurantId,
      fulfillment: "pickup",
      items: [{ menuItemId: m1, quantity: 1 }],
      phone: "0901234567",
      address: null,
      lat: null,
      lng: null,
      note: null,
    });
    const id = Number(order.id);

    const auth0 = (await getOrderAuth(id))!;
    expect(auth0.buyerId).toBe(buyer.id);
    expect(auth0.restaurantId).toBe(restaurantId);

    await advanceStatus(auth0, "accepted", owner.id);
    const auth1 = (await getOrderAuth(id))!;
    expect(auth1.status).toBe("accepted");

    await advanceStatus(auth1, "ready", owner.id);
    const auth2 = (await getOrderAuth(id))!;
    expect(auth2.status).toBe("ready");

    const completed = await advanceStatus(auth2, "completed", owner.id);
    expect(completed.status).toBe("completed");
    expect(completed.events.map((e) => e.status)).toEqual([
      "pending",
      "accepted",
      "ready",
      "completed",
    ]);
  });

  it("listOrdersForSeller / sellerOrderCounts chỉ thấy đơn của quán mình", async () => {
    const list = await listOrdersForSeller(owner, restaurantId);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((o) => o.restaurantId === String(restaurantId))).toBe(true);

    expect(await listOrdersForSeller(other, restaurantId)).toEqual([]);
    expect((await sellerOrderCounts(other)).pending).toBe(0);
    expect((await sellerOrderCounts(owner)).pending).toBeGreaterThanOrEqual(1);
  });
});
