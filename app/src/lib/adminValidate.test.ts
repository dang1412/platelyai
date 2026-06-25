import { describe, it, expect } from "vitest";
import { optionalLatLng, ValidationError } from "./adminValidate";

// Unit test thuần (không DB) cho validate toạ độ dùng chung POST/PATCH quán.
describe("optionalLatLng", () => {
  it("cả hai rỗng/null → { null, null }", () => {
    expect(optionalLatLng(null, null)).toEqual({ lat: null, lng: null });
    expect(optionalLatLng(undefined, undefined)).toEqual({ lat: null, lng: null });
    expect(optionalLatLng("", "")).toEqual({ lat: null, lng: null });
  });

  it("toạ độ hợp lệ (số hoặc chuỗi)", () => {
    expect(optionalLatLng(21.03, 105.85)).toEqual({ lat: 21.03, lng: 105.85 });
    expect(optionalLatLng("21.03", "105.85")).toEqual({ lat: 21.03, lng: 105.85 });
    expect(optionalLatLng(0, 0)).toEqual({ lat: 0, lng: 0 });
  });

  it("thiếu một trong hai → lỗi", () => {
    expect(() => optionalLatLng(21.03, null)).toThrow(ValidationError);
    expect(() => optionalLatLng(null, 105.85)).toThrow(ValidationError);
    expect(() => optionalLatLng("21.03", "")).toThrow(ValidationError);
  });

  it("ngoài range → lỗi", () => {
    expect(() => optionalLatLng(91, 105)).toThrow(ValidationError);
    expect(() => optionalLatLng(-91, 105)).toThrow(ValidationError);
    expect(() => optionalLatLng(21, 181)).toThrow(ValidationError);
    expect(() => optionalLatLng(21, -181)).toThrow(ValidationError);
  });

  it("không phải số → lỗi", () => {
    expect(() => optionalLatLng("abc", "105")).toThrow(ValidationError);
    expect(() => optionalLatLng(NaN, 105)).toThrow(ValidationError);
  });
});
