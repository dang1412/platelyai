import { describe, it, expect } from "vitest";
import { rerank, type Candidate } from "./rank";
import type { RestaurantSummary } from "./types";

// Helper dựng candidate gọn — chỉ set field cần cho từng test.
let nextId = 1;
function cand(
  summary: Partial<RestaurantSummary>,
  extra: Omit<Candidate, "summary"> = {},
): Candidate {
  return {
    summary: {
      id: nextId++,
      name: "Quán",
      address: null,
      rating: null,
      ratingCount: null,
      tags: [],
      website: null,
      googlePlaceId: null,
      ...summary,
    },
    ...extra,
  };
}
const ids = (rs: RestaurantSummary[]) => rs.map((r) => r.id);

describe("rerank", () => {
  it("candidates rỗng → []", () => {
    expect(rerank([])).toEqual([]);
  });

  it("coverage (relevance) thắng rating cao", () => {
    const covered = cand({ id: 101 }, { coverage: 1 });
    const rated = cand({ id: 102, rating: "5.0", ratingCount: 2000 });
    expect(ids(rerank([rated, covered]))).toEqual([101, 102]);
  });

  it("ratingNorm Bayesian: nhiều lượt rate thắng 5.0 ít lượt", () => {
    const fewHigh = cand({ id: 1, rating: "5.0", ratingCount: 1 });
    const manyGood = cand({ id: 2, rating: "4.6", ratingCount: 2000 });
    expect(ids(rerank([fewHigh, manyGood]))).toEqual([2, 1]);
  });

  it("cùng rating TRÊN prior (4.8) → nhiều lượt rate thắng", () => {
    const few = cand({ id: 1, rating: "4.8", ratingCount: 10 });
    const many = cand({ id: 2, rating: "4.8", ratingCount: 2000 });
    expect(ids(rerank([few, many]))).toEqual([2, 1]);
  });

  it("cùng rating DƯỚI prior (4.0) → ÍT lượt thắng (shrinkage về prior, cố ý)", () => {
    // 4.0 < prior 4.3: ít lượt được kéo LÊN gần 4.3 (benefit-of-doubt), nhiều lượt giữ ở 4.0.
    const few = cand({ id: 1, rating: "4.0", ratingCount: 10 });
    const many = cand({ id: 2, rating: "4.0", ratingCount: 2000 });
    expect(ids(rerank([few, many]))).toEqual([1, 2]);
  });

  it("nearness: gần hơn xếp trên (tín hiệu khác bằng nhau)", () => {
    const near = cand({ id: 1, distanceM: 100 });
    const far = cand({ id: 2, distanceM: 1400 });
    expect(ids(rerank([far, near]))).toEqual([1, 2]);
    // distanceM null → nearness 0, không hơn quán có distance gần.
    const noDist = cand({ id: 3, distanceM: null });
    expect(ids(rerank([noDist, near]))).toEqual([1, 3]);
  });

  it("tagCoverage: trùng nhiều tag query hơn xếp trên", () => {
    const two = cand({ id: 1, tags: ["yên tĩnh", "rộng"] });
    const one = cand({ id: 2, tags: ["yên tĩnh"] });
    const q = ["yên tĩnh", "rộng"];
    expect(ids(rerank([one, two], false, q))).toEqual([1, 2]);
  });

  it("cheapness chỉ tác động khi wantsCheap", () => {
    const cheap = cand({ id: 1, rating: "4.0", ratingCount: 100 }, { cheapness: 1 });
    const better = cand({ id: 2, rating: "4.5", ratingCount: 100 });
    // wantsCheap=false → cheapness bị bỏ qua, rating cao thắng.
    expect(ids(rerank([cheap, better], false))).toEqual([2, 1]);
    // wantsCheap=true → cheapness được bơm, đảo thứ tự.
    expect(ids(rerank([cheap, better], true))).toEqual([1, 2]);
  });

  it("cắt còn LIMIT (50) kết quả", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      cand({ id: 1000 + i }, { coverage: i / 60 }),
    );
    expect(rerank(many)).toHaveLength(50);
  });

  it("tie-break: điểm bằng → rating cao hơn thắng", () => {
    // rating present → vào score qua ratingNorm; coverage bằng nhau, count bằng → rating cao thắng.
    const hi = cand({ id: 1, rating: "4.8", ratingCount: 100 }, { coverage: 0.5 });
    const lo = cand({ id: 2, rating: "4.2", ratingCount: 100 }, { coverage: 0.5 });
    expect(ids(rerank([lo, hi]))).toEqual([1, 2]);
  });

  it("tie-break: điểm bằng tuyệt đối → nhiều lượt rate hơn thắng", () => {
    // rating null → ratingNorm 0 cả hai; coverage bằng → score bằng tuyệt đối → phân định bằng count.
    const few = cand({ id: 1, rating: null, ratingCount: 10 }, { coverage: 0.5 });
    const many = cand({ id: 2, rating: null, ratingCount: 50 }, { coverage: 0.5 });
    expect(ids(rerank([few, many]))).toEqual([2, 1]);
  });
});
