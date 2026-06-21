import { query } from "./db";
import {
  resolveDishes,
  DISH_DIST_THRESHOLD,
  COVERAGE_DIST_THRESHOLD,
  RADIUS_M,
} from "./dishes";
import type { Candidate } from "./rank";
import type {
  FoodCategory,
  LatLng,
  MatchedDish,
  ParsedQuery,
  RestaurantSummary,
} from "./types";

// Bước 3 — sinh ứng viên cho rerank. Hai nhánh (plan 01 §3):
//  - MÓN  (dishes không rỗng): resolveDishes → gom menu_items về quán (coverage/matchQuality/chip).
//  - QUÁN (dishes rỗng): lọc serves_*/bán kính/giá ở cấp quán; gắn chip giá/rẻ nếu cần.
// Xem plans/01_6_route.md.

const POOL_LIMIT = 100; // ko origin → top theo rating để rerank bounded (plan 01 §3 nhánh QUÁN)
const CHEAP_REF = 40000; // mốc chuẩn hoá cheapness (plan 01 §5)
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Cột chung cho summary (kèm tag vibe của quán). distanceM thêm riêng khi có origin.
const REST_COLS = `r.id, r.name, r.address,
  r.rating       AS "rating",
  r.rating_count AS "ratingCount",
  (SELECT array_agg(t.name)
     FROM restaurant_tags rt JOIN tags t ON t.id = rt.tag_id
    WHERE rt.restaurant_id = r.id) AS "tags",
  r.website,
  r.google_place_id AS "googlePlaceId"`;

function toSummary(r: Record<string, unknown>): RestaurantSummary {
  return {
    id: Number(r.id),
    name: r.name as string,
    address: (r.address as string | null) ?? null,
    rating: (r.rating as string | null) ?? null,
    ratingCount: r.ratingCount != null ? Number(r.ratingCount) : null,
    tags: (r.tags as string[] | null) ?? [],
    website: (r.website as string | null) ?? null,
    googlePlaceId: (r.googlePlaceId as string | null) ?? null,
    distanceM: r.distanceM != null ? Math.round(Number(r.distanceM)) : null,
  };
}

// ── Nhánh MÓN ───────────────────────────────────────────────────────────────

// THUẦN (test được không cần DB): gom MatchedDish về quán đã fetch.
//  - coverage = số queryDish khớp CHẮC (dist <= COVERAGE_DIST_THRESHOLD) / tổng số món hỏi.
//  - matchQuality = 1 - minDist/DISH_DIST_THRESHOLD (khớp ngữ nghĩa tốt nhất của quán).
//  - matchedDishes = tối đa 3 chip; mặc định ưu tiên dist nhỏ. maxPrice → đồng-dist ưu tiên món SÁT
//    GIÁ TRẦN (món sát trần mới "ăn được" trong tầm tiền, đỡ chip nước chấm rẻ). wantsCheap (không
//    maxPrice) → ưu tiên món RẺ trước (chip = đúng món rẻ user muốn) + set cheapness để rerank ưu
//    tiên quán có món khớp rẻ. cheapness tính trên CÁC MÓN KHỚP đã giữ (cap SQL đã ưu tiên giữ món rẻ
//    nhất trong nhóm khớp tên), KHÔNG phải món rẻ nhất toàn menu — đúng ngữ nghĩa "quán này, MÓN NÀY rẻ".
// Quán có trong matched nhưng không có trong summaryById (đã bị fetch lọc) → bỏ.
export function assembleDishCandidates(
  matched: MatchedDish[],
  summaryById: Map<number, RestaurantSummary>,
  maxPrice: number | null,
  wantsCheap: boolean = false,
): Candidate[] {
  type Group = {
    covered: Set<string>;
    items: Map<string, { name: string; price: number | null; dist: number }>;
    minDist: number;
  };
  const groups = new Map<number, Group>();
  for (const d of matched) {
    let g = groups.get(d.restaurantId);
    if (!g) {
      g = { covered: new Set(), items: new Map(), minDist: Infinity };
      groups.set(d.restaurantId, g);
    }
    if (d.dist <= COVERAGE_DIST_THRESHOLD) g.covered.add(d.queryDish);
    const ex = g.items.get(d.name);
    if (!ex || d.dist < ex.dist)
      g.items.set(d.name, { name: d.name, price: d.price, dist: d.dist });
    if (d.dist < g.minDist) g.minDist = d.dist;
  }
  const numDishes = new Set(matched.map((d) => d.queryDish)).size || 1;

  // cheap chỉ tác động khi wantsCheap mà KHÔNG có maxPrice (maxPrice là ràng buộc định lượng, chip
  // ưu tiên SÁT TRẦN thắng — đồng bộ thứ tự ưu tiên của nhánh QUÁN).
  const cheap = wantsCheap && maxPrice == null;

  const out: Candidate[] = [];
  for (const [rid, g] of groups) {
    const summary = summaryById.get(rid);
    if (!summary) continue;
    const items = [...g.items.values()];
    summary.matchedDishes = items
      .sort((a, b) =>
        cheap
          ? (a.price ?? Infinity) - (b.price ?? Infinity) || a.dist - b.dist
          : a.dist - b.dist ||
            (maxPrice != null ? (b.price ?? 0) - (a.price ?? 0) : 0),
      )
      .slice(0, 3)
      .map((it) => ({ name: it.name, price: it.price }));
    const candidate: Candidate = {
      summary,
      coverage: g.covered.size / numDishes,
      matchQuality: clamp01(1 - g.minDist / DISH_DIST_THRESHOLD),
    };
    if (cheap) {
      // Giá rẻ nhất trong các món khớp đã giữ (>0 để bỏ món 0đ/khuyến mãi nhiễu).
      const prices = items
        .map((it) => it.price)
        .filter((p): p is number => p != null && p > 0);
      const minPrice = prices.length ? Math.min(...prices) : null;
      candidate.cheapness = minPrice != null ? clamp01(1 - minPrice / CHEAP_REF) : 0;
    }
    out.push(candidate);
  }
  return out;
}

export async function candidatesFromDishes(
  parsed: ParsedQuery,
  origin: LatLng | null,
): Promise<Candidate[]> {
  const matched = await resolveDishes(
    parsed.dishes,
    parsed.maxPrice,
    parsed.category,
    origin,
    parsed.wantsCheap,
  );
  if (matched.length === 0) return [];

  // resolveDishes đã lọc bán kính/giá/kind; quán gom từ id món khớp. Fetch summary + (origin)
  // distanceM để rerank. Không lọc serves_* (item đã định hướng loại; serves_* nhiễu loại oan quán).
  const ids = [...new Set(matched.map((d) => d.restaurantId))];
  const params: unknown[] = [ids];
  let distSel = "";
  if (origin) {
    const lngI = params.push(origin.lng);
    const latI = params.push(origin.lat);
    distSel = `, ST_Distance(r.location, ST_MakePoint($${lngI}, $${latI})::geography) AS "distanceM"`;
  }
  const rows = await query(
    `SELECT ${REST_COLS}${distSel} FROM restaurants r WHERE r.id = ANY($1::bigint[])`,
    params,
  );
  const summaryById = new Map(rows.map((r) => [Number(r.id), toSummary(r)]));
  return assembleDishCandidates(matched, summaryById, parsed.maxPrice, parsed.wantsCheap);
}

// ── Nhánh QUÁN ──────────────────────────────────────────────────────────────

export async function candidatesNearbyOrTop(
  parsed: ParsedQuery,
  origin: LatLng | null,
): Promise<Candidate[]> {
  const params: unknown[] = [];
  const where = ["r.name IS NOT NULL"];

  // Có maxPrice → lọc CỨNG quán có ≥1 món đúng kind ≤ giá (EXISTS); bỏ serves_* (item đã hàm ý
  // loại + có menu). Quán không có dữ liệu menu/giá bị loại — chấp nhận (plan §3).
  // Ko maxPrice → serves_* là gate cấp quán DUY NHẤT (phủ cả quán không menu).
  if (parsed.maxPrice != null) {
    const pI = params.push(parsed.maxPrice);
    const kindCond =
      parsed.category != null ? `AND mc.kind = $${params.push(parsed.category)}` : "";
    where.push(`EXISTS (SELECT 1 FROM menu_items mi
                          JOIN menu_categories mc ON mc.id = mi.category_id
                         WHERE mi.restaurant_id = r.id AND mi.price <= $${pI} ${kindCond})`);
  } else if (parsed.category === "food") {
    where.push("r.serves_food = true");
  } else if (parsed.category === "drink") {
    where.push("r.serves_drink = true");
  }

  // Có origin → lọc cứng bán kính + tính distanceM. Ko origin → top POOL_LIMIT theo rating.
  let distSel = "";
  let orderLimit = "";
  if (origin) {
    const lngI = params.push(origin.lng);
    const latI = params.push(origin.lat);
    distSel = `, ST_Distance(r.location, ST_MakePoint($${lngI}, $${latI})::geography) AS "distanceM"`;
    where.push(
      `ST_DWithin(r.location, ST_MakePoint($${lngI}, $${latI})::geography, ${RADIUS_M})`,
    );
  } else {
    orderLimit = `ORDER BY r.rating_count DESC NULLS LAST, r.rating DESC NULLS LAST LIMIT ${POOL_LIMIT}`;
  }

  const rows = await query(
    `SELECT ${REST_COLS}${distSel} FROM restaurants r WHERE ${where.join(" AND ")} ${orderLimit}`,
    params,
  );
  const candidates: Candidate[] = rows.map((r) => ({ summary: toSummary(r) }));

  if (candidates.length > 0) {
    if (parsed.maxPrice != null) {
      // Chip món ĐẮT NHẤT vẫn ≤ trần (rẻ-nhất hay là đồ phụ/nước chấm).
      await attachChips(candidates, parsed.category, "priced", parsed.maxPrice);
    } else if (parsed.wantsCheap) {
      // Chip món RẺ NHẤT đúng kind + set cheapness để rerank ưu tiên quán rẻ.
      await attachChips(candidates, parsed.category, "cheapest", null);
    }
  }
  return candidates;
}

// Gắn tối đa 3 chip món cho mỗi quán. mode "priced": món ≤ maxPrice, ĐẮT trước. mode "cheapest":
// món > 0đ, RẺ trước + set cheapness từ món rẻ nhất. 1 query gom hết quán, group trong JS.
async function attachChips(
  candidates: Candidate[],
  category: FoodCategory | null,
  mode: "priced" | "cheapest",
  maxPrice: number | null,
): Promise<void> {
  const ids = candidates.map((c) => c.summary.id);
  const params: unknown[] = [ids];
  const conds = ["mi.price IS NOT NULL"];
  if (mode === "priced") conds.push(`mi.price <= $${params.push(maxPrice)}`);
  else conds.push("mi.price > 0");
  if (category != null) conds.push(`mc.kind = $${params.push(category)}`);

  const rows = await query(
    `SELECT mi.restaurant_id, mi.name, mi.price
       FROM menu_items mi JOIN menu_categories mc ON mc.id = mi.category_id
      WHERE mi.restaurant_id = ANY($1::bigint[]) AND ${conds.join(" AND ")}
      ORDER BY mi.price ${mode === "priced" ? "DESC" : "ASC"}`,
    params,
  );

  const byRest = new Map<number, { name: string; price: number | null }[]>();
  for (const r of rows) {
    const rid = Number(r.restaurant_id);
    const list = byRest.get(rid) ?? [];
    // Dedup theo tên (nhiều category có thể trùng tên món, vd "Cơm trắng").
    if (list.length < 3 && !list.some((x) => x.name === r.name))
      list.push({ name: r.name as string, price: Number(r.price) });
    byRest.set(rid, list);
  }
  for (const c of candidates) {
    const list = byRest.get(c.summary.id) ?? [];
    c.summary.matchedDishes = list;
    if (mode === "cheapest") {
      const minPrice = list[0]?.price ?? null; // ASC → phần tử đầu rẻ nhất
      c.cheapness = minPrice != null ? clamp01(1 - minPrice / CHEAP_REF) : 0;
    }
  }
}
