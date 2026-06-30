import { describe, it, expect } from "vitest";
import { parseBuyerProfile } from "./profileValidate";
import { ValidationError } from "./adminValidate";

describe("parseBuyerProfile", () => {
  it("body rỗng → tất cả null", () => {
    expect(parseBuyerProfile({})).toEqual({
      phone: null,
      address: null,
      lat: null,
      lng: null,
    });
  });

  it("body không phải object → throw", () => {
    expect(() => parseBuyerProfile(null)).toThrow(ValidationError);
    expect(() => parseBuyerProfile("x")).toThrow(ValidationError);
  });

  it("phone hợp lệ giữ nguyên (trim)", () => {
    expect(parseBuyerProfile({ phone: " 0901234567 " }).phone).toBe("0901234567");
  });

  it("phone rỗng → null", () => {
    expect(parseBuyerProfile({ phone: "  " }).phone).toBeNull();
  });

  it("phone sai định dạng → throw", () => {
    expect(() => parseBuyerProfile({ phone: "12345" })).toThrow(ValidationError);
    expect(() => parseBuyerProfile({ phone: "1901234567" })).toThrow(ValidationError);
  });

  it("address + lat/lng đủ cặp → OK", () => {
    expect(
      parseBuyerProfile({ address: "1 Lê Lợi", lat: 10.77, lng: 106.7 }),
    ).toEqual({ phone: null, address: "1 Lê Lợi", lat: 10.77, lng: 106.7 });
  });

  it("lat/lng thiếu cặp → throw", () => {
    expect(() =>
      parseBuyerProfile({ address: "1 Lê Lợi", lat: 10.77 }),
    ).toThrow(ValidationError);
  });

  it("có toạ độ nhưng không có địa chỉ → throw", () => {
    expect(() => parseBuyerProfile({ lat: 10.77, lng: 106.7 })).toThrow(
      ValidationError,
    );
  });
});
