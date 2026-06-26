import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query, pool } from "./db";
import { resolveDishes, LOOSE_LEX_DIST } from "./dishes";

// Integration test chạm Postgres thật (AGENTS §6): verify cột search_vec (gộp "category món") +
// trigger + match phraseto/plainto end-to-end. Bỏ qua nếu không có DATABASE_URL.
//
// Cô lập khỏi data thật: đặt quán test ở toạ độ (0,0) — giữa đại dương, cách data VN (lng ~105-107)
// hàng ngàn km — rồi truyền origin=(0,0). ST_DWithin RADIUS_M lọc cứng → resolveDishes chỉ thấy quán
// test, không bị cắt DISH_TOP_K theo rating của hàng nghìn món "Phở bò / Tái" thật.
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const ORIGIN = { lat: 0, lng: 0 };

d("resolveDishes trên search_vec (DB thật)", () => {
  let restaurantId: number;
  let categoryId: number;
  let itemId: number;

  beforeAll(async () => {
    const r = await query<{ id: string }>(
      `INSERT INTO restaurants (name, location, lat, lng)
       VALUES ($1, ST_MakePoint(0, 0)::geography, 0, 0) RETURNING id`,
      [`__test_dish_search_${Date.now()}`],
    );
    restaurantId = Number(r[0].id);
    const c = await query<{ id: string }>(
      `INSERT INTO menu_categories (restaurant_id, category_name)
       VALUES ($1, 'Phở bò') RETURNING id`,
      [restaurantId],
    );
    categoryId = Number(c[0].id);
    // Tên món chỉ là biến thể "Tái" — trigger phải gộp category → search_vec = "phở bò tái".
    const it = await query<{ id: string }>(
      `INSERT INTO menu_items (restaurant_id, category_id, name, price)
       VALUES ($1, $2, 'Tái', 60000) RETURNING id`,
      [restaurantId, categoryId],
    );
    itemId = Number(it[0].id);
  });

  afterAll(async () => {
    if (restaurantId) {
      await query(`DELETE FROM menu_items WHERE restaurant_id = $1`, [restaurantId]);
      await query(`DELETE FROM menu_categories WHERE restaurant_id = $1`, [restaurantId]);
      await query(`DELETE FROM restaurants WHERE id = $1`, [restaurantId]);
    }
    await pool.end();
  });

  it("trigger điền search_vec lúc INSERT (gộp category + name)", async () => {
    const rows = await query<{ ok: boolean }>(
      `SELECT search_vec @@ phraseto_tsquery('simple','phở bò tái') AS ok
         FROM menu_items WHERE id = $1`,
      [itemId],
    );
    expect(rows[0].ok).toBe(true);
  });

  it("phraseto khớp cụm liền kề → dist 0 (món 'Tái' dưới cat 'Phở bò')", async () => {
    const out = await resolveDishes(["phở bò tái"], null, ORIGIN);
    const m = out.find((x) => x.itemId === itemId);
    expect(m).toBeDefined();
    expect(m!.dist).toBe(0);
  });

  it("bỏ từ giữa 'phở tái' → chỉ plainto khớp → LOOSE_LEX_DIST", async () => {
    const out = await resolveDishes(["phở tái"], null, ORIGIN);
    const m = out.find((x) => x.itemId === itemId);
    expect(m).toBeDefined();
    expect(m!.dist).toBe(LOOSE_LEX_DIST);
  });

  it("trigger propagate: đổi category_name → search_vec con cập nhật", async () => {
    await query(`UPDATE menu_categories SET category_name = 'Phở gà' WHERE id = $1`, [categoryId]);
    try {
      // Giờ search_vec = "phở gà tái": "phở gà tái" khớp dist 0; "phở bò tái" không còn 'bò' → mất.
      const gaOut = await resolveDishes(["phở gà tái"], null, ORIGIN);
      expect(gaOut.find((x) => x.itemId === itemId)?.dist).toBe(0);

      const boOut = await resolveDishes(["phở bò tái"], null, ORIGIN);
      expect(boOut.find((x) => x.itemId === itemId)).toBeUndefined();
    } finally {
      await query(`UPDATE menu_categories SET category_name = 'Phở bò' WHERE id = $1`, [categoryId]);
    }
  });
});
