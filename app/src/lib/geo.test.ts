import { describe, expect, it } from "vitest";
import { haversineMeters } from "./geo";

describe("haversineMeters", () => {
  it("trả 0 khi trùng điểm", () => {
    expect(haversineMeters({ lat: 21.0, lng: 105.8 }, { lat: 21.0, lng: 105.8 })).toBe(0);
  });

  it("1 độ vĩ ≈ 111 km", () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("khoảng cách ngắn ~ vài trăm mét (Hà Nội)", () => {
    // ~0.005 độ vĩ quanh Hồ Gươm ≈ 550m.
    const d = haversineMeters(
      { lat: 21.028, lng: 105.852 },
      { lat: 21.033, lng: 105.852 },
    );
    expect(d).toBeGreaterThan(500);
    expect(d).toBeLessThan(600);
  });

  it("đối xứng a→b = b→a", () => {
    const a = { lat: 21.0, lng: 105.8 };
    const b = { lat: 21.01, lng: 105.81 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});
