import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveDishes,
  DISH_DIST_THRESHOLD,
  LEX_CATEGORY_DIST,
  SYN_LEX_DIST,
} from "./dishes";

// Mock DB + embed: dishes.ts chỉ là tầng query, test logic gom/dedup/lọc không chạm Postgres.
const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("./db", () => ({ query: queryMock }));

const { embedManyMock } = vi.hoisted(() => ({ embedManyMock: vi.fn() }));
vi.mock("./embed", () => ({
  embedMany: embedManyMock,
  toVectorLiteral: (v: number[]) => `[${v.join(",")}]`,
}));

const isKnn = (sql: string) => sql.includes("<=>");

// Định tuyến mock theo loại query (KNN vs lexical) để mỗi test khai báo rows gọn.
function route(knn: unknown[], lex: unknown[]) {
  queryMock.mockImplementation((sql: string) =>
    Promise.resolve(isKnn(sql) ? knn : lex),
  );
}

beforeEach(() => {
  queryMock.mockReset();
  embedManyMock.mockReset();
  embedManyMock.mockResolvedValue([[0.1, 0.2]]); // 1 tên món → 1 vector
});

describe("resolveDishes", () => {
  it("không có tên món → [] , không gọi embed/DB", async () => {
    expect(await resolveDishes([])).toEqual([]);
    expect(await resolveDishes(["  "])).toEqual([]);
    expect(embedManyMock).not.toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("gom KNN + lexical, dedup theo itemId giữ dist nhỏ nhất", async () => {
    route(
      [{ id: 1, restaurant_id: 9, name: "Phở bò", price: 50000, dist: 0.12 }],
      [{ id: 1, restaurant_id: 9, name: "Phở bò", price: 50000, name_exact: true, name_any: true }],
    );
    const out = await resolveDishes(["phở bò"]);
    expect(out).toHaveLength(1);
    // lexical name_exact → dist 0 < 0.12 ⇒ thắng.
    expect(out[0]).toMatchObject({ itemId: 1, dist: 0, queryDish: "phở bò" });
  });

  it("KNN: loại món có dist > ngưỡng", async () => {
    route(
      [
        { id: 1, restaurant_id: 9, name: "Phở bò", price: 50000, dist: 0.1 },
        { id: 2, restaurant_id: 9, name: "Phở gà", price: 40000, dist: DISH_DIST_THRESHOLD + 0.01 },
      ],
      [],
    );
    const out = await resolveDishes(["phở"]);
    expect(out.map((d) => d.itemId)).toEqual([1]);
  });

  it("lexical: name_exact → dist 0, match qua tên category → LEX_CATEGORY_DIST", async () => {
    route(
      [],
      [
        { id: 1, restaurant_id: 9, name: "Tái lăn", price: 60000, name_exact: false, name_any: false },
        { id: 2, restaurant_id: 8, name: "Phở bò tái", price: 55000, name_exact: true, name_any: true },
      ],
    );
    const out = await resolveDishes(["phở"]);
    const byId = Object.fromEntries(out.map((d) => [d.itemId, d.dist]));
    expect(byId[1]).toBe(LEX_CATEGORY_DIST);
    expect(byId[2]).toBe(0);
  });

  it("đồng nghĩa: hỏi 'gà rán' → pattern $2 chứa 'gà chiên', khớp synonym → SYN_LEX_DIST", async () => {
    route(
      [],
      [{ id: 1, restaurant_id: 9, name: "Gà chiên giòn", price: 50000, name_exact: false, name_any: true }],
    );
    const out = await resolveDishes(["gà rán"]);
    expect(out[0]).toMatchObject({ itemId: 1, dist: SYN_LEX_DIST });
    // $2 (anyPattern) phải có biến thể đồng nghĩa "chiên".
    const [, lexParams] = queryMock.mock.calls.find((c) => !isKnn(c[0]))!;
    expect(String(lexParams[1])).toContain("chiên");
  });

  it("maxPrice + category → đẩy filter vào SQL params + JOIN kind", async () => {
    route([], []);
    await resolveDishes(["phở"], 50000, "food");
    const [knnSql, knnParams] = queryMock.mock.calls.find((c) => isKnn(c[0]))!;
    expect(knnSql).toContain("JOIN menu_categories mc");
    expect(knnSql).toContain("mc.kind =");
    expect(knnParams).toContain(50000);
    expect(knnParams).toContain("food");

    const [lexSql, lexParams] = queryMock.mock.calls.find((c) => !isKnn(c[0]))!;
    expect(lexSql).toContain("WHERE kind =");
    expect(lexParams).toContain("food");
    expect(lexParams).toContain(50000);
  });

  it("có origin → lọc cứng bán kính (ST_DWithin) trên CẢ KNN lẫn lexical", async () => {
    route([], []);
    await resolveDishes(["phở"], null, null, { lat: 10, lng: 106 });

    const [knnSql, knnParams] = queryMock.mock.calls.find((c) => isKnn(c[0]))!;
    expect(knnSql).toContain("JOIN restaurants");
    expect(knnSql).toContain("ST_DWithin");
    expect(knnParams).toEqual(expect.arrayContaining([106, 10]));

    const [lexSql, lexParams] = queryMock.mock.calls.find((c) => !isKnn(c[0]))!;
    expect(lexSql).toContain("ST_DWithin"); // lọc cứng
    expect(lexSql).toContain("ST_Distance"); // vẫn ORDER theo gần
    expect(lexParams).toEqual(expect.arrayContaining([106, 10]));
  });

  it("không origin → không chạm restaurants / ST_DWithin", async () => {
    route([], []);
    await resolveDishes(["phở"]);
    for (const [sql] of queryMock.mock.calls) {
      expect(sql).not.toContain("ST_DWithin");
      expect(sql).not.toContain("JOIN restaurants");
    }
  });

  it("embed trả null (thiếu key) → chỉ chạy lexical", async () => {
    embedManyMock.mockResolvedValue(null);
    route([], [{ id: 1, restaurant_id: 9, name: "Phở", price: 1, name_exact: true, name_any: true }]);
    const out = await resolveDishes(["phở"]);
    expect(out).toHaveLength(1);
    expect(queryMock.mock.calls.every((c) => !isKnn(c[0]))).toBe(true);
  });
});
