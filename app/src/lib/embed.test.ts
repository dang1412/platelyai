import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toVectorLiteral, embedQuery, embedMany } from "./embed";

// Mock SDK openai: new OpenAI().embeddings.create(...) → createMock.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    embeddings = { create: createMock };
  },
}));

describe("toVectorLiteral", () => {
  it.each([
    [[1, 2, 3], "[1,2,3]"],
    [[], "[]"],
    [[0.5, -0.25], "[0.5,-0.25]"],
  ])("%j → %s", (vec, expected) => {
    expect(toVectorLiteral(vec)).toBe(expected);
  });
});

describe("embedQuery / embedMany", () => {
  beforeEach(() => {
    createMock.mockReset();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("thiếu OPENAI_API_KEY → null, không gọi API", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await embedQuery("phở")).toBeNull();
    expect(await embedMany(["phở"])).toBeNull();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("input rỗng → null, không gọi API", async () => {
    expect(await embedQuery("   ")).toBeNull();
    expect(await embedMany([])).toBeNull();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("embedMany ok → vector đúng thứ tự", async () => {
    createMock.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }],
    });
    expect(await embedMany(["a", "b"])).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it("embedQuery ok → vector đầu tiên", async () => {
    createMock.mockResolvedValue({ data: [{ embedding: [0.9, 0.8] }] });
    expect(await embedQuery("phở")).toEqual([0.9, 0.8]);
  });

  it("API throw → null", async () => {
    createMock.mockRejectedValue(new Error("rate limit"));
    expect(await embedQuery("phở")).toBeNull();
  });
});
