import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query, pool } from "@/lib/db";
import { createOwnedRestaurant } from "./createRestaurant";

// Integration test chạm Postgres thật (AGENTS §6). Tự tạo user rồi dọn user + quán tạo ra ở
// afterAll. Bỏ qua nếu không có DATABASE_URL.
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("createOwnedRestaurant (DB thật)", () => {
  const tag = `__test_create_${Date.now()}`;
  let uid: number; // user thường, sẽ thành owner
  const createdIds: number[] = [];

  async function role(id: number): Promise<string> {
    const [u] = await query<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [id]);
    return u.role;
  }

  beforeAll(async () => {
    const [u] = await query<{ id: string }>(
      `INSERT INTO users (email, name, role) VALUES ($1,$2,'user') RETURNING id`,
      [`${tag}@x.test`, "creator"],
    );
    uid = Number(u.id);
  });

  afterAll(async () => {
    for (const r of createdIds) {
      await query(`DELETE FROM restaurant_owners WHERE restaurant_id = $1`, [r]);
      await query(`DELETE FROM restaurants WHERE id = $1`, [r]);
    }
    if (uid) await query(`DELETE FROM users WHERE id = $1`, [uid]);
    await pool.end();
  });

  it("tạo quán có toạ độ: source='user', location đúng, gán owner + nâng role", async () => {
    const lat = 10.77;
    const lng = 106.7;
    const { id } = await createOwnedRestaurant({
      ownerId: uid,
      name: `${tag}_r1`,
      address: "1 Test",
      phone: null,
      website: null,
      lat,
      lng,
    });
    createdIds.push(id);

    const [r] = await query<{
      source: string;
      lat: number;
      lng: number;
      x: number;
      y: number;
    }>(
      `SELECT source, lat, lng, ST_X(location::geometry) AS x, ST_Y(location::geometry) AS y
         FROM restaurants WHERE id = $1`,
      [id],
    );
    expect(r.source).toBe("user");
    expect(Number(r.x)).toBeCloseTo(lng, 5);
    expect(Number(r.y)).toBeCloseTo(lat, 5);

    const owners = await query<{ user_id: string }>(
      `SELECT user_id FROM restaurant_owners WHERE restaurant_id = $1`,
      [id],
    );
    expect(owners.map((o) => Number(o.user_id))).toEqual([uid]);
    expect(await role(uid)).toBe("owner");
  });

  it("tạo quán không toạ độ: location IS NULL", async () => {
    const { id } = await createOwnedRestaurant({
      ownerId: uid,
      name: `${tag}_r2`,
      address: null,
      phone: null,
      website: null,
      lat: null,
      lng: null,
    });
    createdIds.push(id);

    const [r] = await query<{ location: unknown }>(
      `SELECT location FROM restaurants WHERE id = $1`,
      [id],
    );
    expect(r.location).toBeNull();
  });
});
