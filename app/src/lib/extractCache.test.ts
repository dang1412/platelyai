import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getOrCompute,
  buildKey,
  _resetExtractCache,
  CACHE_MAX,
  CACHE_TTL_MS,
} from "./extractCache";
import type { ParsedQuery } from "./types";

const PQ = (dishes: string[] = []): ParsedQuery => ({
  dishes,
  tags: [],
  location: null,
  maxPrice: null,
  wantsCheap: false,
});

beforeEach(() => _resetExtractCache());

describe("buildKey", () => {
  it("chuẩn hoá hoa/thường + khoảng trắng thừa → cùng key", () => {
    expect(buildKey("  Phở   Bò ", ["a"])).toBe(buildKey("phở bò", ["a"]));
  });

  it("vocab khác → key khác", () => {
    expect(buildKey("phở", ["a"])).not.toBe(buildKey("phở", ["a", "b"]));
  });

  it("vocab cùng nội dung khác thứ tự → cùng key", () => {
    expect(buildKey("phở", ["a", "b"])).toBe(buildKey("phở", ["b", "a"]));
  });
});

describe("getOrCompute", () => {
  it("hit: 2 lượt cùng key → compute chỉ chạy 1 lần", async () => {
    const compute = vi.fn(async () => PQ(["phở"]));
    const a = await getOrCompute("k1", compute);
    const b = await getOrCompute("k1", compute);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(a).toEqual(PQ(["phở"]));
    expect(b).toEqual(PQ(["phở"]));
  });

  it("compute trả null → KHÔNG cache → lượt sau gọi lại", async () => {
    const compute = vi.fn(async () => null);
    expect(await getOrCompute("k2", compute)).toBeNull();
    await getOrCompute("k2", compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("single-flight: 2 lượt đồng thời → compute 1 lần, cùng kết quả", async () => {
    let resolve!: (v: ParsedQuery) => void;
    const compute = vi.fn(
      () => new Promise<ParsedQuery | null>((r) => (resolve = r)),
    );
    const p1 = getOrCompute("k3", compute);
    const p2 = getOrCompute("k3", compute);
    resolve(PQ(["bún"]));
    const [a, b] = await Promise.all([p1, p2]);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(a).toEqual(PQ(["bún"]));
    expect(b).toEqual(PQ(["bún"]));
  });

  it("LRU evict khi vượt CACHE_MAX → key cũ nhất phải compute lại", async () => {
    for (let i = 0; i < CACHE_MAX; i++) {
      await getOrCompute(`key${i}`, async () => PQ([`d${i}`]));
    }
    await getOrCompute("keyNew", async () => PQ(["new"])); // vượt cap → evict key0
    const recompute = vi.fn(async () => PQ(["d0-again"]));
    await getOrCompute("key0", recompute);
    expect(recompute).toHaveBeenCalledTimes(1);
  });

  it("TTL hết hạn → miss lại", async () => {
    vi.useFakeTimers();
    try {
      const compute = vi.fn(async () => PQ(["chè"]));
      await getOrCompute("k4", compute);
      vi.advanceTimersByTime(CACHE_TTL_MS + 1);
      await getOrCompute("k4", compute);
      expect(compute).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
