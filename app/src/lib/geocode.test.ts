import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseGeocodeResponse, geocode, _resetGeocodeCache } from "./geocode";

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

  it("response !ok → null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response));
    expect(await geocode("Nơi lỗi")).toBeNull();
  });

  it("fetch throw → null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await geocode("Nơi mạng lỗi")).toBeNull();
  });
});
