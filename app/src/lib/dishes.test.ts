import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveDishes, LOOSE_LEX_DIST, SYN_LEX_DIST } from "./dishes";

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

  it("dedup theo itemId giữ dist nhỏ nhất (cùng món, dist khác nhau)", async () => {
    // Cùng itemId: dòng chỉ-plainto (LOOSE) và dòng phraseto gốc (exact → 0) → giữ 0.
    route(
      [],
      [
        { id: 1, restaurant_id: 9, name: "Phở bò", price: 50000, name_exact: false, name_phrase: false },
        { id: 1, restaurant_id: 9, name: "Phở bò", price: 50000, name_exact: true, name_phrase: true },
      ],
    );
    const out = await resolveDishes(["phở bò"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ itemId: 1, dist: 0, queryDish: "phở bò" });
  });

  it("lexical 3 tier: phraseto gốc → 0, chỉ plainto → LOOSE_LEX_DIST", async () => {
    route(
      [],
      [
        // Khớp đủ token nhưng không liền kề/đúng thứ tự (vd "Tái" dưới cat "Phở bò", hỏi "phở tái").
        { id: 1, restaurant_id: 9, name: "Tái", price: 60000, name_exact: false, name_phrase: false },
        // Khớp cụm liền kề đúng thứ tự trên search_vec → tên đích danh.
        { id: 2, restaurant_id: 8, name: "Phở bò tái", price: 55000, name_exact: true, name_phrase: true },
      ],
    );
    const out = await resolveDishes(["phở bò tái"]);
    const byId = Object.fromEntries(out.map((d) => [d.itemId, d.dist]));
    expect(byId[1]).toBe(LOOSE_LEX_DIST);
    expect(byId[2]).toBe(0);
  });

  it("đồng nghĩa: hỏi 'gà rán' → biến thể 'gà chiên' vào params, phraseto khớp → SYN_LEX_DIST", async () => {
    route(
      [],
      [{ id: 1, restaurant_id: 9, name: "Gà chiên giòn", price: 50000, name_exact: false, name_phrase: true }],
    );
    const out = await resolveDishes(["gà rán"]);
    expect(out[0]).toMatchObject({ itemId: 1, dist: SYN_LEX_DIST });
    // Biến thể đồng nghĩa "gà chiên" phải được đẩy vào params (dùng cho cả plainto lẫn phraseto).
    const [lexSql, lexParams] = queryMock.mock.calls.find((c) => !isKnn(c[0]))!;
    expect(lexParams).toContain("gà chiên");
    expect(lexSql).toContain("phraseto_tsquery");
  });

  it("query dùng search_vec: gate plainto + cờ phraseto, KHÔNG còn UNION category-only", async () => {
    route([], []);
    await resolveDishes(["phở bò"]);
    const [lexSql] = queryMock.mock.calls.find((c) => !isKnn(c[0]))!;
    expect(lexSql).toContain("mi.search_vec @@");
    expect(lexSql).toContain("plainto_tsquery"); // gate WHERE
    expect(lexSql).toContain("phraseto_tsquery"); // cờ name_exact/name_phrase
    expect(lexSql).not.toContain("UNION ALL"); // bỏ nhánh category-only
    expect(lexSql).not.toContain("category_name"); // không còn match tên category
  });

  it("maxPrice + category → đẩy filter vào SQL params + lọc kind (lexical)", async () => {
    route([], []);
    await resolveDishes(["phở"], 50000, "food");
    const [lexSql, lexParams] = queryMock.mock.calls.find((c) => !isKnn(c[0]))!;
    expect(lexSql).toContain("WHERE kind =");
    expect(lexParams).toContain("food");
    expect(lexParams).toContain(50000);
  });

  it("wantsCheap → cap mỗi quán chèn price ASC (giữ món khớp rẻ nhất)", async () => {
    route([], []);
    await resolveDishes(["phở"], null, null, null, true);
    const [lexSql] = queryMock.mock.calls.find((c) => !isKnn(c[0]))!;
    expect(lexSql).toContain("u.price ASC NULLS LAST");
  });

  it("không wantsCheap → cap KHÔNG chèn price (giữ thứ tự khớp tên)", async () => {
    route([], []);
    await resolveDishes(["phở"]);
    const [lexSql] = queryMock.mock.calls.find((c) => !isKnn(c[0]))!;
    expect(lexSql).not.toContain("u.price ASC");
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
