import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveDishes, LEX_CATEGORY_DIST, SYN_LEX_DIST } from "./dishes";

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

  it("dedup theo itemId giữ dist nhỏ nhất (2 nhánh UNION cùng món)", async () => {
    // Cùng itemId từ nhánh category (0.05) và nhánh name (exact → 0) → giữ 0.
    route(
      [],
      [
        { id: 1, restaurant_id: 9, name: "Phở bò", price: 50000, name_exact: false, name_any: false },
        { id: 1, restaurant_id: 9, name: "Phở bò", price: 50000, name_exact: true, name_any: true },
      ],
    );
    const out = await resolveDishes(["phở bò"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ itemId: 1, dist: 0, queryDish: "phở bò" });
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
    // Biến thể đồng nghĩa "gà chiên" phải được đẩy vào params (→ phraseto_tsquery của anyTsq).
    const [lexSql, lexParams] = queryMock.mock.calls.find((c) => !isKnn(c[0]))!;
    expect(lexParams).toContain("gà chiên");
    expect(lexSql).toContain("phraseto_tsquery");
  });

  it("maxPrice + category → đẩy filter vào SQL params + lọc kind (lexical)", async () => {
    route([], []);
    await resolveDishes(["phở"], 50000, "food");
    const [lexSql, lexParams] = queryMock.mock.calls.find((c) => !isKnn(c[0]))!;
    expect(lexSql).toContain("WHERE kind =");
    expect(lexParams).toContain("food");
    expect(lexParams).toContain(50000);
  });

  it("có origin → lexical lọc cứng bán kính (ST_DWithin) + ORDER theo gần", async () => {
    route([], []);
    await resolveDishes(["phở"], null, null, { lat: 10, lng: 106 });

    const [lexSql, lexParams] = queryMock.mock.calls.find((c) => !isKnn(c[0]))!;
    expect(lexSql).toContain("ST_DWithin"); // lọc cứng
    expect(lexSql).toContain("ST_Distance"); // vẫn ORDER theo gần
    expect(lexParams).toEqual(expect.arrayContaining([106, 10]));
  });

  it("không origin → KHÔNG lọc cứng bán kính (ST_DWithin); lexical ORDER theo rating giảm dần", async () => {
    route([], []);
    await resolveDishes(["phở"]);
    const [lexSql] = queryMock.mock.calls.find((c) => !isKnn(c[0]))!;
    expect(lexSql).not.toContain("ST_DWithin"); // không lọc cứng bán kính
    // Lexical vẫn JOIN restaurants để lấy rating, sắp giảm dần (giữ quán tốt khi cắt TOP_K).
    expect(lexSql).toContain("JOIN restaurants");
    expect(lexSql).toContain("ORDER BY ord DESC NULLS LAST");
  });
});
