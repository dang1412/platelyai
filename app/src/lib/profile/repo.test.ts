import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query, pool } from "@/lib/db";
import { getBuyerProfile, upsertBuyerProfile } from "./repo";

// Integration test chạm Postgres thật (AGENTS §6). Tự tạo 1 user rồi dọn ở afterAll.
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("profile repo (DB thật)", () => {
  const tag = `__test_profile_${Date.now()}`;
  let userId: number;

  beforeAll(async () => {
    const [u] = await query<{ id: string }>(
      `INSERT INTO users (email, name, role) VALUES ($1,$2,'user') RETURNING id`,
      [`${tag}@x.test`, tag],
    );
    userId = Number(u.id);
  });

  afterAll(async () => {
    if (userId) await query(`DELETE FROM users WHERE id = $1`, [userId]);
    await pool.end();
  });

  it("user mới chưa có thông tin → toàn null", async () => {
    expect(await getBuyerProfile(userId)).toEqual({
      phone: null,
      address: null,
      lat: null,
      lng: null,
    });
  });

  it("upsert rồi get trả đúng (lat/lng là number)", async () => {
    await upsertBuyerProfile(userId, {
      phone: "0901234567",
      address: "1 Lê Lợi",
      lat: 10.7769,
      lng: 106.7009,
    });
    const p = await getBuyerProfile(userId);
    expect(p).toEqual({
      phone: "0901234567",
      address: "1 Lê Lợi",
      lat: 10.7769,
      lng: 106.7009,
    });
    expect(typeof p.lat).toBe("number");
  });

  it("upsert ghi đè giá trị cũ (xoá về null)", async () => {
    await upsertBuyerProfile(userId, {
      phone: null,
      address: null,
      lat: null,
      lng: null,
    });
    expect(await getBuyerProfile(userId)).toEqual({
      phone: null,
      address: null,
      lat: null,
      lng: null,
    });
  });
});
