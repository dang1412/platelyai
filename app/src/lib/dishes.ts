import { query } from "./db";
// KNN semantic TẠM TẮT — embedding không tách được sắc thái món Việt tên ngắn (đo thật: "bún riêu"
// gần "bún bò" hơn "bún cua"; "gà rán" gần "gà nướng" hơn "gà chiên"). Lexical+synonym gánh chính.
// import { embedMany, toVectorLiteral } from "./embed";
import { expandSynonyms } from "./synonyms";
import type { FoodCategory, LatLng, MatchedDish } from "./types";

// Bước 4 (nhánh MÓN) — map mỗi tên món user hỏi về các menu_items khớp, để bước rank gom về quán.
// Xem plans/01_4_dishes.md.

// Số ứng viên KNN lấy cho mỗi tên món (đủ gom về nhiều quán), và ngưỡng cosine distance tối đa để
// giữ. Đo thật trên menu_items (text-embedding-3-small, query "Món: <q>"): match thật ~0.07-0.20,
// trôi sang "liên quan nhưng khác" từ ~0.25 → đặt 0.30 (sim >= 0.70). Cả hai tunable.
export const DISH_TOP_K = 150;
export const DISH_DIST_THRESHOLD = 0.3;

// Số món tối đa giữ lại cho MỖI quán trước khi cắt DISH_TOP_K. Một quán phở liệt kê hàng chục biến
// thể (tái/chín/gàu/nạm/đặc biệt…); không chặn thì vài quán menu to "ăn" hết TOP_K, các quán khớp
// còn lại không bao giờ được fetch (món phổ biến + không origin → cắt theo rating, dồn về ~12 quán
// rating cao). Cap này để TOP_K trải ra ~DISH_TOP_K/cap quán. Downstream chip cũng chỉ lấy ≤3 món.
export const DISH_PER_RESTAURANT = 3;

// Ngưỡng "khớp chắc" — chặt hơn DISH_DIST_THRESHOLD. Chỉ món có dist <= ngưỡng này mới được TÍNH
// VÀO coverage ở rank, tránh quán phủ nhiều món LỎNG vượt quán phủ ít món CHUẨN. Món trong khoảng
// (gate, threshold] vẫn hiện ra (recall) nhưng không cộng coverage. Tunable.
export const COVERAGE_DIST_THRESHOLD = 0.2;

// dist gán cho món match qua TÊN CATEGORY (menu Việt hay để tên món ở category, tên món chỉ còn
// biến thể: "Phở Tái" → "Tái lăn"). Nhỏ hơn COVERAGE_DIST_THRESHOLD (vẫn tính phủ) nhưng > 0 để
// món match đích danh tên (dist=0) vẫn thắng khi chọn chip.
export const LEX_CATEGORY_DIST = 0.05;

// dist gán cho món khớp qua ĐỒNG NGHĨA (bảng synonyms.ts), vd hỏi "gà rán" trúng "gà chiên giòn".
// > 0 để khớp đích danh tên (dist=0) vẫn thắng, nhưng < COVERAGE_DIST_THRESHOLD → VẪN tính coverage
// (đồng nghĩa đã được curate đúng, khác hẳn semantic mờ). Tunable.
export const SYN_LEX_DIST = 0.03;

// Bán kính lọc cứng khi có origin (m). Là 1 nguồn sự thật cho geo radius — rank.ts sẽ import lại
// để chuẩn hoá nearness. Tunable (plan 01 §5).
export const RADIUS_M = 1500;

// Gom món từ 2 nguồn rồi dedup theo itemId (giữ dist nhỏ nhất):
//  1) Semantic KNN trên menu_items.embedding — embed "Món: <tên>" (KHÔNG prefix khác, khớp đúng
//     dạng đã sinh embedding trong DB), giữ dist <= DISH_DIST_THRESHOLD.
//  2) Lexical (FTS): tên món khớp NGUYÊN TỪ trong name CÓ DẤU → dist = 0 (mạnh nhất), bắt khớp tên
//     chính xác mà KNN có thể xếp thấp. Dùng full-text 'simple' (token theo phi-alnum, giữ dấu) để
//     hit GIN index thay vì seq scan — vừa giữ ngữ nghĩa ranh-giới-từ ("chè" ⊄ "cheese") vừa
//     sublinear khi DB lớn. + đồng nghĩa (synonyms.ts) → SYN_LEX_DIST. Match thêm trên TÊN CATEGORY
//     (dist = LEX_CATEGORY_DIST) cho ca tên món bị cắt theo category. Xem plans/01_4b_synonyms.md.
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
  wantsCheap: boolean = false,
): Promise<MatchedDish[]> {
  const names = dishes.map((d) => d.trim()).filter(Boolean);
  if (names.length === 0) return [];

  // const vecs = await embedMany(names.map((n) => "Món: " + n)); // KNN tạm tắt

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

    // ── Semantic KNN (TẠM TẮT — xem ghi chú ở import) ────────────────────────────
    // if (vecs) {
    //   const lit = toVectorLiteral(vecs[i]);
    //   const params: unknown[] = [lit];
    //   const joins: string[] = [];
    //   const where = ["mi.embedding IS NOT NULL"];
    //   if (category != null) {
    //     joins.push("JOIN menu_categories mc ON mc.id = mi.category_id");
    //     where.push(`mc.kind = $${params.push(category)}`);
    //   }
    //   if (maxPrice != null) where.push(`mi.price <= $${params.push(maxPrice)}`);
    //   if (origin) joins.push(geoJoin(params, origin).sql);
    //   const rows = await query<DishRow>(
    //     `SELECT mi.id, mi.restaurant_id, mi.name, mi.price,
    //             (mi.embedding <=> $1::vector) AS dist
    //      FROM menu_items mi
    //      ${joins.join("\n         ")}
    //      WHERE ${where.join(" AND ")}
    //      ORDER BY mi.embedding <=> $1::vector
    //      LIMIT ${DISH_TOP_K}`,
    //     params,
    //   );
    //   for (const r of rows) {
    //     const dist = Number(r.dist);
    //     if (dist > DISH_DIST_THRESHOLD) continue;
    //     add(r, dist, queryDish);
    //   }
    // }

    // ── Lexical (+ đồng nghĩa), full-text search ─────────────────────────────────
    // Mở rộng tên hỏi ra các biến thể đồng nghĩa (synonyms.ts), match qua FTS 'simple' để DÙNG
    // ĐƯỢC GIN index (menu_items_name_fts_idx) — sublinear khi DB lớn, KHÔNG seq scan. 'simple' tách
    // token theo phi-alnum + GIỮ DẤU → đúng ngữ nghĩa ranh-giới-từ cũ ("chè" ⊄ "cheese"). Mỗi biến
    // thể → 1 phraseto_tsquery (cụm nhiều từ giữ thứ tự, vd "bún riêu" → bún<->riêu), OR bằng `||`.
    // exactTsq = CHỈ tên gốc (variants[0]) → name_exact (dist 0); anyTsq = cả đồng nghĩa → SYN_LEX_DIST.
    const variants = expandSynonyms(queryDish);
    const params: unknown[] = [];
    const tsq = (v: string) => `phraseto_tsquery('simple', $${params.push(v)})`;
    const anyTsq = variants.map(tsq).join(" || ");
    const exactTsq = `phraseto_tsquery('simple', $1)`; // variants[0] = param $1 (push đầu tiên)
    // Lọc kind/price — tham chiếu lại cùng $n ở CẢ HAI nhánh UNION (không push lại).
    const kindFilter =
      category != null
        ? `AND mi.category_id IN (SELECT id FROM menu_categories WHERE kind = $${params.push(category)})`
        : "";
    const priceFilter =
      maxPrice != null ? `AND mi.price <= $${params.push(maxPrice)}` : "";
    // ord quyết định MÓN nào sống sót khi cắt LIMIT DISH_TOP_K (món phổ biến match hàng nghìn dòng):
    //  - Có origin → INNER JOIN ST_DWithin lọc cứng bán kính, ord = khoảng cách (gần nhất trước).
    //  - Không origin → JOIN restaurants lấy rating, ord = rating GIẢM DẦN (giữ quán tốt thay vì
    //    tùy tiện theo id). Tie-break theo mi.id cho xác định. JOIN restaurants tái dùng cho cả 2 nhánh.
    let join = "";
    let ord: string;
    let orderClause: string;
    if (origin) {
      const g = geoJoin(params, origin);
      join = g.sql;
      ord = `ST_Distance(r.location, ST_MakePoint($${g.lngI}, $${g.latI})::geography)`;
      orderClause = "ORDER BY ord ASC, id ASC";
    } else {
      join = "JOIN restaurants r ON r.id = mi.restaurant_id";
      ord = "r.rating";
      orderClause = "ORDER BY ord DESC NULLS LAST, id ASC";
    }
    // UNION ALL hai nhánh để MỖI nhánh hit index riêng (gộp OR ép seq scan): nhánh TÊN dùng FTS GIN,
    // nhánh CATEGORY resolve category qua FTS rồi lọc mi.category_id (btree). Trùng itemId giữa 2
    // nhánh do add() dedup theo dist nhỏ nhất.
    // Cap DISH_PER_RESTAURANT món/quán (ROW_NUMBER partition theo quán) TRƯỚC khi cắt TOP_K, để pool
    // trải đều ra nhiều quán thay vì dồn vào vài quán menu to. Ưu tiên giữ món khớp tên đích danh
    // (name_exact) rồi đồng nghĩa (name_any) khi chọn món đại diện của quán.
    // wantsCheap (yếu tố 6): chèn `price ASC` vào SAU tier khớp tên → quán giữ lại 3 món khớp RẺ nhất
    // (vẫn trong nhóm khớp chuẩn nhất, không để đồ phụ rẻ đè món chính). Vì cap chạy TRƯỚC TOP_K, đây
    // cũng là cách DUY NHẤT đảm bảo món rẻ sống sót để downstream tính cheapness + chip đúng món rẻ.
    const capOrder = wantsCheap
      ? "u.name_exact DESC, u.name_any DESC, u.price ASC NULLS LAST, u.id ASC"
      : "u.name_exact DESC, u.name_any DESC, u.id ASC";
    const lex = await query<DishRow>(
      `SELECT id, restaurant_id, name, price, name_exact, name_any FROM (
         SELECT u.*, ROW_NUMBER() OVER (
                  PARTITION BY u.restaurant_id
                  ORDER BY ${capOrder}
                ) AS rn
         FROM (
           SELECT mi.id, mi.restaurant_id, mi.name, mi.price,
                  (to_tsvector('simple', lower(mi.name)) @@ (${exactTsq})) AS name_exact,
                  TRUE AS name_any, ${ord} AS ord
           FROM menu_items mi
           ${join}
           WHERE to_tsvector('simple', lower(mi.name)) @@ (${anyTsq})
             ${kindFilter}
             ${priceFilter}
           UNION ALL
           SELECT mi.id, mi.restaurant_id, mi.name, mi.price,
                  FALSE AS name_exact, FALSE AS name_any, ${ord} AS ord
           FROM menu_items mi
           ${join}
           WHERE mi.category_id IN (
                   SELECT id FROM menu_categories
                   WHERE to_tsvector('simple', lower(category_name)) @@ (${anyTsq}))
             ${kindFilter}
             ${priceFilter}
         ) u
       ) ranked
       WHERE rn <= ${DISH_PER_RESTAURANT}
       ${orderClause}
       LIMIT ${DISH_TOP_K}`,
      params,
    );
    // Đích danh tên → 0; đồng nghĩa → SYN_LEX_DIST; chỉ khớp tên category → LEX_CATEGORY_DIST.
    for (const r of lex)
      add(r, r.name_exact ? 0 : r.name_any ? SYN_LEX_DIST : LEX_CATEGORY_DIST, queryDish);
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
  name_exact?: boolean;
  name_any?: boolean;
};
