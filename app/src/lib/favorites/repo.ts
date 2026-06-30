// Lớp dữ liệu quán yêu thích (mọi SQL tham số hoá $1,$2…, §3). Bảng user_favorites (PK kép
// user+restaurant) — xem db/init/13_favorites.sql.

import { query } from "@/lib/db";
import { REST_COLS, toSummary } from "@/lib/candidates";
import type { RestaurantSummary } from "@/lib/types";

export async function isFavorite(
  userId: number,
  restaurantId: number,
): Promise<boolean> {
  const rows = await query(
    `SELECT 1 FROM user_favorites WHERE user_id = $1 AND restaurant_id = $2 LIMIT 1`,
    [userId, restaurantId],
  );
  return rows.length > 0;
}

// Thêm (idempotent — bấm lại không lỗi).
export async function addFavorite(
  userId: number,
  restaurantId: number,
): Promise<void> {
  await query(
    `INSERT INTO user_favorites (user_id, restaurant_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, restaurantId],
  );
}

export async function removeFavorite(
  userId: number,
  restaurantId: number,
): Promise<void> {
  await query(
    `DELETE FROM user_favorites WHERE user_id = $1 AND restaurant_id = $2`,
    [userId, restaurantId],
  );
}

// Quán yêu thích của user (mới đánh dấu lên trước) — dạng summary để render card.
export async function listFavoriteRestaurants(
  userId: number,
): Promise<RestaurantSummary[]> {
  const rows = await query(
    `SELECT ${REST_COLS}
       FROM user_favorites f
       JOIN restaurants r ON r.id = f.restaurant_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC`,
    [userId],
  );
  return rows.map(toSummary);
}
