import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query, pool } from "@/lib/db";
import {
  isFavorite,
  addFavorite,
  removeFavorite,
  listFavoriteRestaurants,
} from "./repo";

// Integration test chạm Postgres thật (AGENTS §6). Tự tạo user + 2 quán rồi dọn ở afterAll.
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("favorites repo (DB thật)", () => {
  const tag = `__test_fav_${Date.now()}`;
  let userId: number;
  let r1: number;
  let r2: number;

  beforeAll(async () => {
    const [u] = await query<{ id: string }>(
      `INSERT INTO users (email, role) VALUES ($1, 'user') RETURNING id`,
      [`${tag}@x.test`],
    );
    userId = Number(u.id);
    const mk = async (name: string) => {
      const [r] = await query<{ id: string }>(
        `INSERT INTO restaurants (name, location, lat, lng)
         VALUES ($1, ST_MakePoint(0,0)::geography, 0, 0) RETURNING id`,
        [name],
      );
      return Number(r.id);
    };
    r1 = await mk(`${tag}_a`);
    r2 = await mk(`${tag}_b`);
  });

  afterAll(async () => {
    if (userId) await query(`DELETE FROM users WHERE id = $1`, [userId]);
    for (const id of [r1, r2]) {
      if (id) await query(`DELETE FROM restaurants WHERE id = $1`, [id]);
    }
    await pool.end();
  });

  it("chưa đánh dấu → isFavorite false, list rỗng", async () => {
    expect(await isFavorite(userId, r1)).toBe(false);
    expect(await listFavoriteRestaurants(userId)).toHaveLength(0);
  });

  it("add → isFavorite true; add lại idempotent", async () => {
    await addFavorite(userId, r1);
    await addFavorite(userId, r1); // không lỗi, không nhân đôi
    expect(await isFavorite(userId, r1)).toBe(true);
    const list = await listFavoriteRestaurants(userId);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(r1);
  });

  it("list theo created_at giảm dần (mới nhất trước)", async () => {
    await addFavorite(userId, r2);
    const list = await listFavoriteRestaurants(userId);
    expect(list.map((r) => r.id)).toEqual([r2, r1]);
  });

  it("remove → isFavorite false", async () => {
    await removeFavorite(userId, r1);
    expect(await isFavorite(userId, r1)).toBe(false);
    expect((await listFavoriteRestaurants(userId)).map((r) => r.id)).toEqual([r2]);
  });
});
