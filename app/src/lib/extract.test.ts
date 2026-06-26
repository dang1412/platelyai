import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseExtraction, extractQuery } from "./extract";
import { _resetExtractCache } from "./extractCache";
import type { ParsedQuery } from "./types";

// Mock SDK Gemini: extractQuery test ở tầng cache/dedupe, không gọi mạng thật.
const { generateContentMock } = vi.hoisted(() => ({ generateContentMock: vi.fn() }));
vi.mock("@google/genai", () => ({
  // regular function (không arrow) để dùng được với `new GoogleGenAI()`.
  GoogleGenAI: vi.fn(function () {
    return { models: { generateContent: generateContentMock } };
  }),
  Type: { OBJECT: "OBJECT", STRING: "STRING", ARRAY: "ARRAY", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN" },
}));

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

describe("extractQuery cache", () => {
  const ok = (raw: object) => ({ text: JSON.stringify(raw) });

  beforeEach(() => {
    _resetExtractCache();
    generateContentMock.mockReset();
    process.env.GEMINI_API_KEY = "test-key";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("cùng q 2 lần → Gemini chỉ gọi 1 lần (cache hit)", async () => {
    generateContentMock.mockResolvedValue(ok({ dishes: ["phở bò"], tags: [], wants_cheap: false }));
    const a = await extractQuery("phở bò", []);
    const b = await extractQuery("phở bò", []);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(a.dishes).toEqual(["phở bò"]);
    expect(b).toEqual(a);
  });

  it("q chuẩn hoá (hoa/thường, khoảng trắng) → vẫn cache hit", async () => {
    generateContentMock.mockResolvedValue(ok({ dishes: ["phở"], tags: [], wants_cheap: false }));
    await extractQuery("Phở", []);
    await extractQuery("  phở ", []);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("lỗi Gemini → fallback, KHÔNG cache → lượt sau gọi lại", async () => {
    generateContentMock
      .mockRejectedValueOnce(new Error("503 overloaded"))
      .mockResolvedValueOnce(ok({ dishes: ["bún"], tags: [], wants_cheap: false }));
    const a = await extractQuery("bún chả", []);
    expect(a.dishes).toEqual([]); // fallback
    const b = await extractQuery("bún chả", []);
    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(b.dishes).toEqual(["bún"]);
  });

  it("vocab khác → key khác → gọi Gemini lại", async () => {
    generateContentMock.mockResolvedValue(ok({ dishes: ["trà"], tags: [], wants_cheap: false }));
    await extractQuery("trà sữa", ["a"]);
    await extractQuery("trà sữa", ["a", "b"]);
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });
});
