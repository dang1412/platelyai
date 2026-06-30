import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseGeocodeResponse, geocode, _resetGeocodeCache, CACHE_MAX } from "./geocode";

describe("parseGeocodeResponse", () => {
  it("đọc toạ độ địa điểm đầu tiên", () => {
    expect(
      parseGeocodeResponse({ places: [{ location: { latitude: 21.0, longitude: 105.8 } }] }),
    ).toEqual({ lat: 21.0, lng: 105.8 });
  });

  it("places rỗng → null", () => {
    expect(parseGeocodeResponse({ places: [] })).toBeNull();
  });

  it("không có field places → null", () => {
    expect(parseGeocodeResponse({})).toBeNull();
  });

  it("location thiếu toạ độ → null", () => {
    expect(parseGeocodeResponse({ places: [{}] })).toBeNull();
  });
});

describe("geocode", () => {
  beforeEach(() => {
    _resetGeocodeCache();
    vi.stubEnv("GOOGLE_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const okResponse = (lat: number, lng: number) =>
    ({
      ok: true,
      json: async () => ({ places: [{ location: { latitude: lat, longitude: lng } }] }),
    }) as Response;

  it("location rỗng → null, không gọi fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await geocode("   ")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("thiếu GOOGLE_API_KEY → null, không gọi fetch", async () => {
    vi.stubEnv("GOOGLE_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await geocode("Vincom")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("response ok → LatLng, gọi lần 2 dùng cache (fetch 1 lần)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(21.0, 105.8));
    vi.stubGlobal("fetch", fetchMock);

    expect(await geocode("Vincom Bà Triệu")).toEqual({ lat: 21.0, lng: 105.8 });
    expect(await geocode("Vincom Bà Triệu")).toEqual({ lat: 21.0, lng: 105.8 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("vượt CACHE_MAX → xoá key cũ nhất (LRU)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(1, 1));
    vi.stubGlobal("fetch", fetchMock);

    // Điền đầy cache (CACHE_MAX key khác nhau).
    for (let i = 0; i < CACHE_MAX; i++) await geocode(`addr ${i}`);
    expect(fetchMock).toHaveBeenCalledTimes(CACHE_MAX);

    // "addr 0" còn trong cache → đọc lại không fetch, đồng thời bump lên mới nhất.
    await geocode("addr 0");
    expect(fetchMock).toHaveBeenCalledTimes(CACHE_MAX);

    // Thêm 1 key mới → vượt giới hạn, đẩy key cũ nhất (giờ là "addr 1") ra.
    await geocode(`addr ${CACHE_MAX}`);
    // "addr 1" đã bị evict → phải fetch lại.
    await geocode("addr 1");
    expect(fetchMock).toHaveBeenCalledTimes(CACHE_MAX + 2);
  });

  it("response !ok → null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response));
    expect(await geocode("Nơi lỗi")).toBeNull();
  });

  it("fetch throw → null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await geocode("Nơi mạng lỗi")).toBeNull();
  });
});
