import { withTransaction, type TxQuery } from "./db";

// Merge/upsert menu đã parse vào DB (xem plans/05_admin_menu_parse.md):
// - Category: match theo (restaurant_id, lower(category_name)) → tái dùng, không tạo trùng.
// - Item: match theo (restaurant_id, normalized_name) → có thì UPDATE giá/mô tả/nhóm, chưa thì INSERT.
// - Món cũ KHÔNG có trong payload: để nguyên (không xoá, không tắt).
// Toàn bộ chạy trong 1 transaction (withTransaction) nên nguyên tử.

export type ImportItem = {
  name: string;
  price: number | null;
  description: string | null;
};
export type ImportCategory = {
  categoryName: string;
  displayOrder: number;
  items: ImportItem[];
};
export type ImportResult = {
  categories: number;
  itemsInserted: number;
  itemsUpdated: number;
};

// Tìm/tạo category, trả id. Tái dùng category trùng tên (không phân biệt hoa/thường).
async function upsertCategory(
  q: TxQuery,
  restaurantId: number,
  cat: ImportCategory,
): Promise<number> {
  const found = await q<{ id: string }>(
    `SELECT id FROM menu_categories
      WHERE restaurant_id = $1 AND lower(category_name) = lower($2)
      ORDER BY id ASC LIMIT 1`,
    [restaurantId, cat.categoryName],
  );
  if (found[0]) return Number(found[0].id);
  const inserted = await q<{ id: string }>(
    `INSERT INTO menu_categories (restaurant_id, category_name, display_order)
     VALUES ($1, $2, $3) RETURNING id`,
    [restaurantId, cat.categoryName, cat.displayOrder],
  );
  return Number(inserted[0].id);
}

// Upsert 1 món vào category đã có id. Trả "inserted" | "updated".
async function upsertItem(
  q: TxQuery,
  restaurantId: number,
  categoryId: number,
  item: ImportItem,
): Promise<"inserted" | "updated"> {
  // Match theo normalized_name = lower(unaccent(name)), không bó theo category (món đổi nhóm
  // vẫn nhận ra là cũ). Trùng nhiều dòng → lấy id nhỏ nhất, để yên phần còn lại.
  const found = await q<{ id: string }>(
    `SELECT id FROM menu_items
      WHERE restaurant_id = $1 AND normalized_name = lower(unaccent($2))
      ORDER BY id ASC LIMIT 1`,
    [restaurantId, item.name],
  );
  if (found[0]) {
    // COALESCE: giá null từ AI → giữ giá cũ; mô tả null → giữ mô tả cũ. Không đụng embedding (tên không đổi).
    await q(
      `UPDATE menu_items
          SET price = COALESCE($1, price),
              description = COALESCE($2, description),
              category_id = $3,
              updated_at = now()
        WHERE id = $4`,
      [item.price, item.description, categoryId, Number(found[0].id)],
    );
    return "updated";
  }
  await q(
    `INSERT INTO menu_items
       (restaurant_id, category_id, name, normalized_name, description, price, is_available)
     VALUES ($1, $2, $3, lower(unaccent($3)), $4, $5, true)`,
    [restaurantId, categoryId, item.name, item.description, item.price],
  );
  return "inserted";
}

export async function importMenu(
  restaurantId: number,
  categories: ImportCategory[],
): Promise<ImportResult> {
  return withTransaction(async (q) => {
    let itemsInserted = 0;
    let itemsUpdated = 0;
    let categoryCount = 0;

    for (const cat of categories) {
      if (cat.items.length === 0) continue;
      const categoryId = await upsertCategory(q, restaurantId, cat);
      categoryCount++;
      for (const item of cat.items) {
        const r = await upsertItem(q, restaurantId, categoryId, item);
        if (r === "inserted") itemsInserted++;
        else itemsUpdated++;
      }
    }

    return { categories: categoryCount, itemsInserted, itemsUpdated };
  });
}
