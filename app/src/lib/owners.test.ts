import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query, pool } from "@/lib/db";
import {
  listRestaurantOwners,
  assignRestaurantOwner,
  removeRestaurantOwner,
  OwnerError,
} from "./owners";

// Integration test chạm Postgres thật (AGENTS §6). Tự tạo user/quán ở toạ độ (0,0) rồi dọn
// ở afterAll. Bỏ qua nếu không có DATABASE_URL.
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("owners lib (DB thật)", () => {
  const tag = `__test_owners_${Date.now()}`;
  let u1: number; // user thường, sẽ thành owner
  let u2: number; // user thường, sẽ thành owner
  let admin: number; // role admin, không được hạ
  let r1: number;
  let r2: number;

  async function role(id: number): Promise<string> {
    const [u] = await query<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [
      id,
    ]);
    return u.role;
  }
  async function mkUser(r: string, key: string): Promise<number> {
    const [u] = await query<{ id: string }>(
      `INSERT INTO users (email, name, role) VALUES ($1,$2,$3) RETURNING id`,
      [`${tag}_${key}@x.test`, key, r],
    );
    return Number(u.id);
  }
  async function mkRestaurant(name: string): Promise<number> {
    const [r] = await query<{ id: string }>(
      `INSERT INTO restaurants (name, location, lat, lng)
       VALUES ($1, ST_MakePoint(0,0)::geography, 0, 0) RETURNING id`,
      [name],
    );
    return Number(r.id);
  }

  beforeAll(async () => {
    u1 = await mkUser("user", "u1");
    u2 = await mkUser("user", "u2");
    admin = await mkUser("admin", "admin");
    r1 = await mkRestaurant(`${tag}_r1`);
    r2 = await mkRestaurant(`${tag}_r2`);
  });

  afterAll(async () => {
    for (const r of [r1, r2]) {
      if (r) await query(`DELETE FROM restaurant_owners WHERE restaurant_id = $1`, [r]);
    }
    for (const r of [r1, r2]) {
      if (r) await query(`DELETE FROM restaurants WHERE id = $1`, [r]);
    }
    for (const u of [u1, u2, admin]) {
      if (u) await query(`DELETE FROM users WHERE id = $1`, [u]);
    }
    await pool.end();
  });

  it("assign: gán nhiều owner + nâng role 'user' -> 'owner'", async () => {
    await assignRestaurantOwner(r1, `${tag}_u1@x.test`);
    await assignRestaurantOwner(r1, `${tag}_u2@x.test`);

    const owners = await listRestaurantOwners(r1);
    expect(owners.map((o) => o.id).sort()).toEqual([u1, u2].sort());
    expect(owners.every((o) => typeof o.id === "number")).toBe(true);
    expect(await role(u1)).toBe("owner");
    expect(await role(u2)).toBe("owner");
  });

  it("assign: idempotent (ON CONFLICT) + email lạ ném OwnerError 404", async () => {
    await assignRestaurantOwner(r1, `${tag}_u1@x.test`);
    expect(await listRestaurantOwners(r1)).toHaveLength(2);

    await expect(assignRestaurantOwner(r1, "khong-ton-tai@x.test")).rejects.toThrow(
      OwnerError,
    );
  });

  it("remove: gỡ owner; hết quán thì hạ role, còn quán thì giữ owner", async () => {
    // u1 sở hữu thêm r2 -> sau khi gỡ khỏi r1 vẫn còn r2 nên giữ 'owner'.
    await assignRestaurantOwner(r2, `${tag}_u1@x.test`);

    await removeRestaurantOwner(r1, u2); // u2 hết quán -> hạ về 'user'
    const owners = await listRestaurantOwners(r1);
    expect(owners.map((o) => o.id)).toEqual([u1]);
    expect(await role(u2)).toBe("user");

    await removeRestaurantOwner(r1, u1); // u1 còn r2 -> giữ 'owner'
    expect(await listRestaurantOwners(r1)).toHaveLength(0);
    expect(await role(u1)).toBe("owner");
  });

  it("remove: không hạ role 'admin' dù hết quán", async () => {
    await query(`INSERT INTO restaurant_owners (restaurant_id, user_id) VALUES ($1,$2)`, [
      r1,
      admin,
    ]);
    await removeRestaurantOwner(r1, admin);
    expect(await role(admin)).toBe("admin");
  });
});
