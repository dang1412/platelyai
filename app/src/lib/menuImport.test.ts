import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query, pool } from "./db";
import { importMenu, type ImportCategory } from "./menuImport";

// Integration test chạm Postgres thật (AGENTS §6). Tạo 1 quán tạm, chạy các kịch bản
// merge/upsert, rồi dọn sạch. Bỏ qua nếu không có DATABASE_URL (ví dụ CI chưa có DB).
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const cat = (
  categoryName: string,
  items: ImportCategory["items"],
  displayOrder = 0,
): ImportCategory => ({ categoryName, displayOrder, items });

d("importMenu (DB thật)", () => {
  let restaurantId: number;

  beforeAll(async () => {
    const rows = await query<{ id: string }>(
      `INSERT INTO restaurants (name) VALUES ($1) RETURNING id`,
      [`__test_import_${Date.now()}`],
    );
    restaurantId = Number(rows[0].id);
  });

  afterAll(async () => {
    if (restaurantId) {
      await query(`DELETE FROM menu_items WHERE restaurant_id = $1`, [restaurantId]);
      await query(`DELETE FROM menu_categories WHERE restaurant_id = $1`, [restaurantId]);
      await query(`DELETE FROM restaurants WHERE id = $1`, [restaurantId]);
    }
    await pool.end();
  });

  it("insert mới đúng restaurant + category + item", async () => {
    const res = await importMenu(restaurantId, [
      cat("Món chính", [
        { name: "Phở bò", price: 45000, description: "Tái nạm" },
        { name: "Bún chả", price: 40000, description: null },
      ]),
    ]);
    expect(res).toEqual({ categories: 1, itemsInserted: 2, itemsUpdated: 0 });

    const items = await query<{ name: string; price: number; restaurant_id: string }>(
      `SELECT name, price, restaurant_id FROM menu_items WHERE restaurant_id = $1 ORDER BY name`,
      [restaurantId],
    );
    expect(items).toHaveLength(2);
    expect(Number(items[0].restaurant_id)).toBe(restaurantId);
  });

  it("upsert: import lại cùng tên → UPDATE giá, không tạo dòng mới", async () => {
    const res = await importMenu(restaurantId, [
      cat("Món chính", [{ name: "Phở bò", price: 50000, description: null }]),
    ]);
    expect(res.itemsInserted).toBe(0);
    expect(res.itemsUpdated).toBe(1);

    const rows = await query<{ price: number }>(
      `SELECT price FROM menu_items
        WHERE restaurant_id = $1 AND normalized_name = lower(unaccent($2))`,
      [restaurantId, "Phở bò"],
    );
    expect(rows).toHaveLength(1); // không nhân bản
    expect(Number(rows[0].price)).toBe(50000); // giá đã cập nhật
  });

  it("giá null trong input → giữ giá cũ", async () => {
    await importMenu(restaurantId, [
      cat("Món chính", [{ name: "Phở bò", price: null, description: null }]),
    ]);
    const rows = await query<{ price: number }>(
      `SELECT price FROM menu_items
        WHERE restaurant_id = $1 AND normalized_name = lower(unaccent($2))`,
      [restaurantId, "Phở bò"],
    );
    expect(Number(rows[0].price)).toBe(50000); // vẫn là giá cũ
  });

  it("item đổi nhóm → chuyển category_id, không nhân bản", async () => {
    await importMenu(restaurantId, [
      cat("Đặc biệt", [{ name: "Phở bò", price: 50000, description: null }]),
    ]);
    const rows = await query<{ id: string; category_name: string }>(
      `SELECT mi.id, mc.category_name
         FROM menu_items mi JOIN menu_categories mc ON mc.id = mi.category_id
        WHERE mi.restaurant_id = $1 AND mi.normalized_name = lower(unaccent($2))`,
      [restaurantId, "Phở bò"],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].category_name).toBe("Đặc biệt");
  });

  it("category trùng tên (khác hoa/thường) → tái dùng, không tạo nhóm trùng", async () => {
    await importMenu(restaurantId, [
      cat("MÓN CHÍNH", [{ name: "Cơm rang", price: 35000, description: null }]),
    ]);
    const cats = await query(
      `SELECT id FROM menu_categories
        WHERE restaurant_id = $1 AND lower(category_name) = lower($2)`,
      [restaurantId, "Món chính"],
    );
    expect(cats).toHaveLength(1);
  });

  it("món cũ vắng mặt trong payload → còn nguyên", async () => {
    const before = await query<{ c: string }>(
      `SELECT count(*)::text AS c FROM menu_items WHERE restaurant_id = $1`,
      [restaurantId],
    );
    await importMenu(restaurantId, [
      cat("Đồ uống", [{ name: "Trà đá", price: 5000, description: null }]),
    ]);
    const after = await query<{ name: string }>(
      `SELECT name FROM menu_items WHERE restaurant_id = $1 AND normalized_name = lower(unaccent($2))`,
      [restaurantId, "Bún chả"],
    );
    expect(after).toHaveLength(1); // Bún chả từ test đầu vẫn còn
    expect(Number(before[0].c)).toBeGreaterThan(0);
  });

  it("1 item lỗi → rollback toàn bộ (không insert phần trước nó)", async () => {
    const countBefore = await query<{ c: string }>(
      `SELECT count(*)::text AS c FROM menu_items WHERE restaurant_id = $1`,
      [restaurantId],
    );
    // name "" sẽ vi phạm NOT NULL? name là NOT NULL nhưng "" hợp lệ. Ép lỗi bằng price kiểu sai.
    await expect(
      importMenu(restaurantId, [
        cat("Lỗi", [
          { name: "Hợp lệ", price: 10000, description: null },
          // price không phải số → SQL lỗi kiểu integer
          { name: "Gây lỗi", price: "x" as unknown as number, description: null },
        ]),
      ]),
    ).rejects.toBeTruthy();

    const countAfter = await query<{ c: string }>(
      `SELECT count(*)::text AS c FROM menu_items WHERE restaurant_id = $1`,
      [restaurantId],
    );
    expect(countAfter[0].c).toBe(countBefore[0].c); // không thêm dòng nào
  });
});
