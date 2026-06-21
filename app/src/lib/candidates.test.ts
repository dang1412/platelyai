import { describe, it, expect } from "vitest";
import { assembleDishCandidates } from "./candidates";
import type { MatchedDish, RestaurantSummary } from "./types";

// Chỉ test hàm THUẦN assembleDishCandidates (gom MatchedDish → Candidate). Phần chạm DB
// (candidatesFromDishes/NearbyOrTop) là wrapper SQL, không unit-test ở đây.

const summary = (id: number): RestaurantSummary => ({
  id,
  name: "Quán " + id,
  address: null,
  rating: null,
  ratingCount: null,
  tags: [],
  website: null,
  googlePlaceId: null,
});
const mapOf = (...ids: number[]) =>
  new Map(ids.map((id) => [id, summary(id)]));

const dish = (p: Partial<MatchedDish> & Pick<MatchedDish, "restaurantId" | "queryDish" | "dist">): MatchedDish => ({
  itemId: Math.random(),
  name: p.name ?? p.queryDish,
  price: p.price ?? null,
  ...p,
});

describe("assembleDishCandidates", () => {
  it("coverage = số queryDish khớp CHẮC / tổng; chỉ đếm dist <= COVERAGE_DIST_THRESHOLD", () => {
    const matched = [
      dish({ restaurantId: 1, queryDish: "phở", dist: 0.1 }), // chắc
      dish({ restaurantId: 1, queryDish: "bún", dist: 0.25, name: "bún chả" }), // lỏng (>0.2)
    ];
    const [c] = assembleDishCandidates(matched, mapOf(1), null);
    expect(c.coverage).toBe(0.5); // 1 (phở) / 2 món hỏi
  });

  it("matchQuality = 1 - minDist/DISH_DIST_THRESHOLD", () => {
    const matched = [dish({ restaurantId: 1, queryDish: "phở", dist: 0.15 })];
    const [c] = assembleDishCandidates(matched, mapOf(1), null);
    expect(c.matchQuality).toBeCloseTo(1 - 0.15 / 0.3); // 0.5
  });

  it("matchedDishes: tối đa 3 chip, ưu tiên dist nhỏ", () => {
    const matched = [
      dish({ restaurantId: 1, queryDish: "x", dist: 0.3, name: "D" }),
      dish({ restaurantId: 1, queryDish: "x", dist: 0.0, name: "A" }),
      dish({ restaurantId: 1, queryDish: "x", dist: 0.1, name: "B" }),
      dish({ restaurantId: 1, queryDish: "x", dist: 0.2, name: "C" }),
    ];
    const [c] = assembleDishCandidates(matched, mapOf(1), null);
    expect(c.summary.matchedDishes?.map((d) => d.name)).toEqual(["A", "B", "C"]);
  });

  it("có maxPrice: đồng dist → ưu tiên món SÁT giá trần (đắt hơn trước)", () => {
    const matched = [
      dish({ restaurantId: 1, queryDish: "x", dist: 0, name: "rẻ", price: 10000 }),
      dish({ restaurantId: 1, queryDish: "x", dist: 0, name: "sát trần", price: 45000 }),
    ];
    const [c] = assembleDishCandidates(matched, mapOf(1), 50000);
    expect(c.summary.matchedDishes?.[0].name).toBe("sát trần");
  });

  it("wantsCheap: chip ưu tiên món RẺ trước + set cheapness từ món khớp rẻ nhất", () => {
    const matched = [
      dish({ restaurantId: 1, queryDish: "phở", dist: 0, name: "Phở đặc biệt", price: 80000 }),
      dish({ restaurantId: 1, queryDish: "phở", dist: 0, name: "Phở bò", price: 40000 }),
    ];
    const [c] = assembleDishCandidates(matched, mapOf(1), null, true);
    expect(c.summary.matchedDishes?.[0].name).toBe("Phở bò"); // rẻ trước
    expect(c.cheapness).toBeCloseTo(1 - 40000 / 40000); // 0 tại mốc CHEAP_REF
  });

  it("wantsCheap: bỏ qua món 0đ khi tính cheapness (lấy giá > 0 rẻ nhất)", () => {
    const matched = [
      dish({ restaurantId: 1, queryDish: "phở", dist: 0, name: "KM 0đ", price: 0 }),
      dish({ restaurantId: 1, queryDish: "phở", dist: 0, name: "Phở bò", price: 20000 }),
    ];
    const [c] = assembleDishCandidates(matched, mapOf(1), null, true);
    expect(c.cheapness).toBeCloseTo(1 - 20000 / 40000); // 0.5, không phải từ 0đ
  });

  it("wantsCheap KÈM maxPrice: maxPrice thắng (chip sát trần, không set cheapness)", () => {
    const matched = [
      dish({ restaurantId: 1, queryDish: "x", dist: 0, name: "rẻ", price: 10000 }),
      dish({ restaurantId: 1, queryDish: "x", dist: 0, name: "sát trần", price: 45000 }),
    ];
    const [c] = assembleDishCandidates(matched, mapOf(1), 50000, true);
    expect(c.summary.matchedDishes?.[0].name).toBe("sát trần");
    expect(c.cheapness).toBeUndefined();
  });

  it("quán không có trong summaryById (bị fetch lọc) → bỏ", () => {
    const matched = [
      dish({ restaurantId: 1, queryDish: "phở", dist: 0.1 }),
      dish({ restaurantId: 2, queryDish: "phở", dist: 0.1 }),
    ];
    const out = assembleDishCandidates(matched, mapOf(1), null); // chỉ quán 1 fetch được
    expect(out.map((c) => c.summary.id)).toEqual([1]);
  });

  it("dedup item theo tên giữ dist nhỏ nhất", () => {
    const matched = [
      dish({ restaurantId: 1, queryDish: "phở", dist: 0.2, name: "Phở bò" }),
      dish({ restaurantId: 1, queryDish: "phở", dist: 0.05, name: "Phở bò" }),
    ];
    const [c] = assembleDishCandidates(matched, mapOf(1), null);
    expect(c.summary.matchedDishes).toHaveLength(1);
    expect(c.matchQuality).toBeCloseTo(1 - 0.05 / 0.3);
  });
});
