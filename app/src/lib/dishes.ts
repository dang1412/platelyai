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

// dist gán cho món CHỈ khớp PLAINTO (đủ token nhưng KHÔNG liền kề/đúng thứ tự) trên search_vec —
// tier recall cho ca "phở tái" (bỏ "bò") hay khác thứ tự. < COVERAGE_DIST_THRESHOLD (0.2) → VẪN
// tính phủ (khớp đúng ngữ nghĩa cho tên món Việt ngắn). Tunable; đặt > 0.2 nếu muốn loại khỏi coverage.
export const LOOSE_LEX_DIST = 0.12;

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
//  2) Lexical (FTS) trên menu_items.search_vec — tsvector GỘP "category món" (xem plan 07), GIN
//     index menu_items_search_vec_idx. Match 2 mức trên CÙNG search_vec: phraseto (cụm liền kề +
//     đúng thứ tự) → tên gốc dist 0, đồng nghĩa (synonyms.ts) → SYN_LEX_DIST; chỉ plainto (đủ token,
//     không liền kề) → LOOSE_LEX_DIST (recall "phở tái"/khác thứ tự). 'simple' = token phi-alnum,
//     GIỮ DẤU ("chè" ⊄ "cheese"). Cột gộp đã chứa token category → KHÔNG còn nhánh category-only.
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

    // ── Lexical (+ đồng nghĩa) trên search_vec, full-text search ──────────────────
    // Mở rộng tên hỏi ra biến thể đồng nghĩa (synonyms.ts). Match trên mi.search_vec (cột GỘP
    // "category món", GIN index) để DÙNG ĐƯỢC index — sublinear, KHÔNG seq scan. 'simple' = token
    // phi-alnum + GIỮ DẤU ("chè" ⊄ "cheese"). Mỗi biến thể push 1 param, tham chiếu ở CẢ plainto lẫn
    // phraseto:
    //  - GATE (WHERE) = plainto (đủ token, không cần liền kề) OR các biến thể — rộng nhất, gom hết
    //    ứng viên. phraseto-match ⊆ plainto-match nên plainto làm gate là đủ.
    //  - name_exact  = phraseto tên GỐC (variants[0]) → dist 0.
    //  - name_phrase = phraseto OR các biến thể → SYN_LEX_DIST (khớp cụm, kể cả qua đồng nghĩa).
    //  - chỉ plainto (không phraseto) → LOOSE_LEX_DIST.
    const variants = expandSynonyms(queryDish);
    const params: unknown[] = [];
    const vIdx = variants.map((v) => params.push(v)); // mỗi biến thể 1 param $idx, dùng lại 2 nơi
    const plainOf = (i: number) => `plainto_tsquery('simple', $${i})`;
    const phraseOf = (i: number) => `phraseto_tsquery('simple', $${i})`;
    const anyPlainto = vIdx.map(plainOf).join(" || ");
    const anyPhraseto = vIdx.map(phraseOf).join(" || ");
    const exactPhraseto = phraseOf(vIdx[0]); // variants[0] = tên gốc
    // Lọc kind/price (một nhánh, tham chiếu $n trực tiếp).
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
    // Một nhánh duy nhất (search_vec đã gộp category → bỏ UNION category-only cũ).
    // Cap DISH_PER_RESTAURANT món/quán (ROW_NUMBER partition theo quán) TRƯỚC khi cắt TOP_K, để pool
    // trải đều ra nhiều quán thay vì dồn vào vài quán menu to. Ưu tiên giữ món khớp tên đích danh
    // (name_exact) rồi khớp cụm/đồng nghĩa (name_phrase) khi chọn món đại diện của quán.
    // wantsCheap (yếu tố 6): chèn `price ASC` vào SAU tier khớp tên → quán giữ lại 3 món khớp RẺ nhất
    // (vẫn trong nhóm khớp chuẩn nhất, không để đồ phụ rẻ đè món chính). Vì cap chạy TRƯỚC TOP_K, đây
    // cũng là cách DUY NHẤT đảm bảo món rẻ sống sót để downstream tính cheapness + chip đúng món rẻ.
    const capOrder = wantsCheap
      ? "u.name_exact DESC, u.name_phrase DESC, u.price ASC NULLS LAST, u.id ASC"
      : "u.name_exact DESC, u.name_phrase DESC, u.id ASC";
    const lex = await query<DishRow>(
      `SELECT id, restaurant_id, name, price, name_exact, name_phrase FROM (
         SELECT u.*, ROW_NUMBER() OVER (
                  PARTITION BY u.restaurant_id
                  ORDER BY ${capOrder}
                ) AS rn
         FROM (
           SELECT mi.id, mi.restaurant_id, mi.name, mi.price,
                  (mi.search_vec @@ (${exactPhraseto})) AS name_exact,
                  (mi.search_vec @@ (${anyPhraseto}))   AS name_phrase,
                  ${ord} AS ord
           FROM menu_items mi
           ${join}
           WHERE mi.search_vec @@ (${anyPlainto})
             ${kindFilter}
             ${priceFilter}
         ) u
       ) ranked
       WHERE rn <= ${DISH_PER_RESTAURANT}
       ${orderClause}
       LIMIT ${DISH_TOP_K}`,
      params,
    );
    // Đích danh tên (phraseto gốc) → 0; khớp cụm qua đồng nghĩa → SYN_LEX_DIST; chỉ plainto → LOOSE.
    for (const r of lex)
      add(r, r.name_exact ? 0 : r.name_phrase ? SYN_LEX_DIST : LOOSE_LEX_DIST, queryDish);
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
  name_phrase?: boolean;
};
