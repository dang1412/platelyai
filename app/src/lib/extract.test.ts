import { describe, it, expect } from "vitest";
import { parseExtraction } from "./extract";
import type { ParsedQuery } from "./types";

const FALLBACK: ParsedQuery = {
  category: null,
  dishes: [],
  tags: [],
  location: null,
  maxPrice: null,
  wantsCheap: false,
};

describe("parseExtraction", () => {
  it("đủ 6 trường, validate tag trong vocab", () => {
    const out = parseExtraction(
      {
        category: "food",
        dishes: ["phở bò"],
        tags: ["bình dân"],
        location: "Vincom",
        max_price: 50000,
        wants_cheap: true,
      },
      ["bình dân", "cà phê"],
    );
    expect(out).toEqual({
      category: "food",
      dishes: ["phở bò"],
      tags: ["bình dân"],
      location: "Vincom",
      maxPrice: 50000,
      wantsCheap: true,
    });
  });

  it("drink + tags rỗng khi vocab rỗng", () => {
    const out = parseExtraction(
      { category: "drink", dishes: ["chè"], tags: [], location: null, max_price: null, wants_cheap: false },
      [],
    );
    expect(out.category).toBe("drink");
    expect(out.tags).toEqual([]);
  });

  it("category sai enum → null", () => {
    expect(parseExtraction({ category: "đồ ăn" }, []).category).toBeNull();
  });

  it("loại tag ngoài vocab", () => {
    const out = parseExtraction({ tags: ["view đẹp", "cà phê"] }, ["cà phê"]);
    expect(out.tags).toEqual(["cà phê"]);
  });

  it("khớp tag không phân biệt hoa/thường, trả về dạng canonical", () => {
    const out = parseExtraction({ tags: ["Cà Phê"] }, ["cà phê"]);
    expect(out.tags).toEqual(["cà phê"]);
  });

  it("dishes trim + bỏ rỗng + dedup", () => {
    const out = parseExtraction({ dishes: [" phở ", " ", "phở"] }, []);
    expect(out.dishes).toEqual(["phở"]);
  });

  it.each([0, -1, "x", null, NaN])("max_price %p không hợp lệ → null", (v) => {
    expect(parseExtraction({ max_price: v as number }, []).maxPrice).toBeNull();
  });

  it("thiếu hết trường → fallback", () => {
    expect(parseExtraction({}, [])).toEqual(FALLBACK);
  });

  it("raw null/undefined → fallback", () => {
    expect(parseExtraction(null, ["cà phê"])).toEqual(FALLBACK);
    expect(parseExtraction(undefined, [])).toEqual(FALLBACK);
  });
});
