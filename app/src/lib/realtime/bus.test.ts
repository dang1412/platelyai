import { describe, it, expect, afterAll } from "vitest";
import { query, pool } from "@/lib/db";
import { subscribe, startListening, stopListening, type OrderNotify } from "./bus";

// Integration test chạm Postgres thật (AGENTS §6): subscribe → pg_notify (qua connection khác của
// pool) → callback nhận đúng payload. Không cần seed (interestedUsers thêm thẳng buyerId).
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("realtime bus (DB thật)", () => {
  afterAll(async () => {
    stopListening();
    await pool.end();
  });

  it("fan-out tới buyer đang subscribe", async () => {
    const userId = 424242; // không cần tồn tại trong users (chỉ so khớp buyerId)
    await startListening(); // chắc chắn LISTEN active trước khi NOTIFY

    const received = new Promise<OrderNotify>((resolve, reject) => {
      const unsub = subscribe(userId, (payload) => {
        unsub();
        resolve(payload);
      });
      setTimeout(() => reject(new Error("timeout: không nhận được notify")), 3000);
    });

    const payload: OrderNotify = {
      orderId: 1,
      status: "pending",
      buyerId: userId,
      restaurantId: 999999999, // không có owner → interested = {buyerId}
    };
    await query(`SELECT pg_notify('order_channel', $1)`, [JSON.stringify(payload)]);

    const got = await received;
    expect(got).toEqual(payload);
  });

  it("fan-out tới admin dù không phải owner của quán", async () => {
    await startListening();
    const [u] = await query<{ id: string }>(
      `INSERT INTO users (email, role) VALUES ($1, 'admin') RETURNING id`,
      [`__test_busadmin_${Date.now()}@x.test`],
    );
    const adminId = Number(u.id);
    try {
      const received = new Promise<OrderNotify>((resolve, reject) => {
        const unsub = subscribe(adminId, (payload) => {
          unsub();
          resolve(payload);
        });
        setTimeout(() => reject(new Error("timeout: admin không nhận được notify")), 3000);
      });

      const payload: OrderNotify = {
        orderId: 2,
        status: "pending",
        buyerId: 111111, // admin KHÁC buyer và KHÔNG phải owner quán
        restaurantId: 999999999,
      };
      await query(`SELECT pg_notify('order_channel', $1)`, [JSON.stringify(payload)]);

      expect(await received).toEqual(payload);
    } finally {
      await query(`DELETE FROM users WHERE id = $1`, [adminId]);
    }
  });
});
