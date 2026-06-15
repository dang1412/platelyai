import { query } from "./db";
import { embedMany, toVectorLiteral } from "./embed";
import type { FoodCategory, LatLng, MatchedDish } from "./types";

// Bước 4 (nhánh MÓN) — map mỗi tên món user hỏi về các menu_items khớp, để bước rank gom về quán.
// Xem plans/01_4_dishes.md.

// Số ứng viên KNN lấy cho mỗi tên món (đủ gom về nhiều quán), và ngưỡng cosine distance tối đa để
// giữ. Đo thật trên menu_items (text-embedding-3-small, query "Món: <q>"): match thật ~0.07-0.20,
// trôi sang "liên quan nhưng khác" từ ~0.25 → đặt 0.30 (sim >= 0.70). Cả hai tunable.
export const DISH_TOP_K = 150;
export const DISH_DIST_THRESHOLD = 0.3;

// Ngưỡng "khớp chắc" — chặt hơn DISH_DIST_THRESHOLD. Chỉ món có dist <= ngưỡng này mới được TÍNH
// VÀO coverage ở rank, tránh quán phủ nhiều món LỎNG vượt quán phủ ít món CHUẨN. Món trong khoảng
// (gate, threshold] vẫn hiện ra (recall) nhưng không cộng coverage. Tunable.
export const COVERAGE_DIST_THRESHOLD = 0.2;

// dist gán cho món match qua TÊN CATEGORY (menu Việt hay để tên món ở category, tên món chỉ còn
// biến thể: "Phở Tái" → "Tái lăn"). Nhỏ hơn COVERAGE_DIST_THRESHOLD (vẫn tính phủ) nhưng > 0 để
// món match đích danh tên (dist=0) vẫn thắng khi chọn chip.
export const LEX_CATEGORY_DIST = 0.05;

// Bán kính lọc cứng khi có origin (m). Là 1 nguồn sự thật cho geo radius — rank.ts sẽ import lại
// để chuẩn hoá nearness. Tunable (plan 01 §5).
export const RADIUS_M = 1500;

// Gom món từ 2 nguồn rồi dedup theo itemId (giữ dist nhỏ nhất):
//  1) Semantic KNN trên menu_items.embedding — embed "Món: <tên>" (KHÔNG prefix khác, khớp đúng
//     dạng đã sinh embedding trong DB), giữ dist <= DISH_DIST_THRESHOLD.
//  2) Lexical: tên món xuất hiện như NGUYÊN TỪ trong name CÓ DẤU → dist = 0 (mạnh nhất), bắt khớp
//     tên chính xác mà KNN có thể xếp thấp. KHÔNG dùng substring + unaccent: "chè" (3 ký tự) lọt
//     vào "cheese"/"cá chép"; khớp ranh giới từ + giữ dấu loại sạch. Match thêm trên TÊN CATEGORY
//     (dist = LEX_CATEGORY_DIST) cho ca tên món bị cắt theo category.
//
// Lọc cứng NGAY trong SQL (không lọc sau — có LIMIT DISH_TOP_K, lọc sau sẽ đánh rơi món xếp > TOP_K):
//  - maxPrice (yếu tố 5): mi.price <= maxPrice. price IS NULL bị loại khi có maxPrice, chấp nhận.
//  - category (yếu tố 1): mc.kind = category (quyết định 01 §6.2). KHÔNG lọc kind thì tên khớp kéo
//    cả topping/nước chấm trùng tên.
//  - origin: ST_DWithin RADIUS_M trên cả KNN lẫn lexical. Lọc cứng bán kính NGAY trong query (không
//    để rank cắt sau) — món phổ biến ("trà sữa") có hàng nghìn match toàn DB, cắt TOP_K trước rồi
//    mới lọc geo sẽ đánh rơi cả vùng địa phương (Meiko bug), và quét toàn quốc cũng tốn. Quán
//    location NULL bị loại (ST_DWithin trên NULL = false), đồng nhất với downstream.
export async function resolveDishes(
  dishes: string[],
  maxPrice: number | null = null,
  category: FoodCategory | null = null,
  origin: LatLng | null = null,
): Promise<MatchedDish[]> {
  const names = dishes.map((d) => d.trim()).filter(Boolean);
  if (names.length === 0) return [];

  const vecs = await embedMany(names.map((n) => "Món: " + n));

  const byItem = new Map<number, MatchedDish>();
  const add = (r: DishRow, dist: number, queryDish: string) => {
    const itemId = Number(r.id);
    const prev = byItem.get(itemId);
    if (prev && prev.dist <= dist) return;
    byItem.set(itemId, {
      itemId,
      restaurantId: Number(r.restaurant_id),
      name: r.name,
      price: r.price != null ? Number(r.price) : null,
      dist,
      queryDish,
    });
  };

  for (let i = 0; i < names.length; i++) {
    const queryDish = names[i];

    // ── Semantic KNN ─────────────────────────────────────────────────────────────
    if (vecs) {
      const lit = toVectorLiteral(vecs[i]);
      const params: unknown[] = [lit];
      const joins: string[] = [];
      const where = ["mi.embedding IS NOT NULL"];
      if (category != null) {
        joins.push("JOIN menu_categories mc ON mc.id = mi.category_id");
        where.push(`mc.kind = $${params.push(category)}`);
      }
      if (maxPrice != null) where.push(`mi.price <= $${params.push(maxPrice)}`);
      if (origin) joins.push(geoJoin(params, origin).sql);
      const rows = await query<DishRow>(
        `SELECT mi.id, mi.restaurant_id, mi.name, mi.price,
                (mi.embedding <=> $1::vector) AS dist
         FROM menu_items mi
         ${joins.join("\n         ")}
         WHERE ${where.join(" AND ")}
         ORDER BY mi.embedding <=> $1::vector
         LIMIT ${DISH_TOP_K}`,
        params,
      );
      for (const r of rows) {
        const dist = Number(r.dist);
        if (dist > DISH_DIST_THRESHOLD) continue;
        add(r, dist, queryDish);
      }
    }

    // ── Lexical ──────────────────────────────────────────────────────────────────
    // Ranh giới từ (phi-chữ hai đầu) trên lower(name) CÓ DẤU. Escape regex để tên món có ()/+…
    // không vỡ pattern.
    const lexPattern =
      "(^|[^[:alnum:]])" +
      queryDish.toLowerCase().replace(/[.^$*+?()[\]{}|\\]/g, "\\$&") +
      "([^[:alnum:]]|$)";
    const params: unknown[] = [lexPattern];
    // Lọc kind: item phải thuộc category đúng kind (subquery riêng, tách khỏi OR match tên category).
    const kindFilter =
      category != null
        ? `AND mi.category_id IN (SELECT id FROM menu_categories WHERE kind = $${params.push(category)})`
        : "";
    const priceFilter =
      maxPrice != null ? `AND mi.price <= $${params.push(maxPrice)}` : "";
    // Có origin → INNER JOIN ST_DWithin lọc cứng bán kính + ORDER theo gần. Không origin → ORDER mi.id
    // (xác định, tránh Postgres trả tuỳ thứ tự vật lý).
    let join = "";
    let orderBy = "ORDER BY mi.id";
    if (origin) {
      const g = geoJoin(params, origin);
      join = g.sql;
      orderBy = `ORDER BY ST_Distance(r.location, ST_MakePoint($${g.lngI}, $${g.latI})::geography) ASC`;
    }
    const lex = await query<DishRow>(
      `SELECT mi.id, mi.restaurant_id, mi.name, mi.price,
              (lower(mi.name) ~ $1) AS name_match
       FROM menu_items mi
       ${join}
       WHERE (lower(mi.name) ~ $1
          OR mi.category_id IN (SELECT id FROM menu_categories WHERE lower(category_name) ~ $1))
         ${kindFilter}
         ${priceFilter}
       ${orderBy}
       LIMIT ${DISH_TOP_K}`,
      params,
    );
    for (const r of lex) add(r, r.name_match ? 0 : LEX_CATEGORY_DIST, queryDish);
  }

  return [...byItem.values()];
}

// JOIN restaurants lọc cứng bán kính RADIUS_M (push lng,lat vào params, trả index để ORDER tái dùng).
// INNER JOIN → quán location NULL bị loại. RADIUS_M là hằng số nội bộ nên nội suy thẳng, an toàn.
function geoJoin(
  params: unknown[],
  origin: LatLng,
): { sql: string; lngI: number; latI: number } {
  const lngI = params.push(origin.lng);
  const latI = params.push(origin.lat);
  return {
    sql: `JOIN restaurants r ON r.id = mi.restaurant_id
         AND ST_DWithin(r.location, ST_MakePoint($${lngI}, $${latI})::geography, ${RADIUS_M})`,
    lngI,
    latI,
  };
}

type DishRow = {
  id: number | string;
  restaurant_id: number | string;
  name: string;
  price: number | string | null;
  dist?: number | string;
  name_match?: boolean;
};
