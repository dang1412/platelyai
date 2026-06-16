import { describe, it, expect } from "vitest";
import { expandSynonyms } from "./synonyms";

describe("expandSynonyms", () => {
  it("query gốc luôn đứng ĐẦU (call site phân biệt đích danh vs đồng nghĩa)", () => {
    expect(expandSynonyms("gà rán")[0]).toBe("gà rán");
    expect(expandSynonyms("  Bún Cua ")[0]).toBe("bún cua"); // lowercase + trim
  });

  it("nhóm cấp-từ: 'gà rán' → có 'gà chiên'; biến thể giữ phần còn lại của tên", () => {
    expect(expandSynonyms("gà rán")).toContain("gà chiên");
    expect(expandSynonyms("cơm sườn heo")).toContain("cơm sườn lợn");
  });

  it("'bánh mỳ' ↔ 'bánh mì' tự xử lý qua nhóm cấp-từ mì/mỳ (không cần nhóm cụm riêng)", () => {
    expect(expandSynonyms("bánh mỳ")).toContain("bánh mì");
    expect(expandSynonyms("bánh mì")).toContain("bánh mỳ");
  });

  it("khớp NGUYÊN TỪ, không phải từ-con: 'ngôi sao' KHÔNG nở ra 'bắp' (ngô ⊂ ngôi)", () => {
    expect(expandSynonyms("ngôi sao")).toEqual(["ngôi sao"]);
  });

  it("tên không dính nhóm nào → chỉ trả chính nó", () => {
    expect(expandSynonyms("bún chả")).toEqual(["bún chả"]);
  });

  it("compose ĐA TẦNG: 'french fries' → 'khoai tây chiên' → 'khoai tây rán'", () => {
    const v = expandSynonyms("french fries");
    expect(v).toContain("khoai tây chiên");
    expect(v).toContain("khoai tây rán");
  });

  it("không đệ quy sinh rác: 'bún cua' nở ĐÚNG ['bún cua','bún riêu'] (member không lồng nhau)", () => {
    expect(expandSynonyms("bún cua")).toEqual(["bún cua", "bún riêu"]);
  });

  it("không trùng lặp & luôn bounded", () => {
    for (const q of ["gà rán", "french fries", "cà phê sữa", "bún cua chua cay"]) {
      const v = expandSynonyms(q);
      expect(new Set(v).size).toBe(v.length);
      expect(v.length).toBeLessThanOrEqual(16);
    }
  });
});
