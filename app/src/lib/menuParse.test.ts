import { describe, it, expect } from "vitest";
import { normalizeParsedMenu } from "./menuParse";

describe("normalizeParsedMenu", () => {
  it("parse cấu trúc đầy đủ, suy kind theo tên nhóm", () => {
    const out = normalizeParsedMenu({
      categories: [
        {
          category_name: "Món chính",
          items: [{ item_name: "Phở bò", price: 45000, description: "Tái nạm" }],
        },
        {
          category_name: "Đồ uống",
          items: [{ item_name: "Cà phê sữa", price: 25000 }],
        },
      ],
    });
    expect(out.categories).toHaveLength(2);
    expect(out.categories[0]).toEqual({
      categoryName: "Món chính",
      kind: "food",
      items: [{ name: "Phở bò", price: 45000, description: "Tái nạm" }],
    });
    expect(out.categories[1].kind).toBe("drink");
    expect(out.categories[1].items[0]).toEqual({
      name: "Cà phê sữa",
      price: 25000,
      description: null,
    });
  });

  it("giá rác/null → null; giá dạng chuỗi '50.000đ' → 50000", () => {
    const out = normalizeParsedMenu({
      categories: [
        {
          category_name: "Test",
          items: [
            { item_name: "A", price: null },
            { item_name: "B", price: "50.000đ" },
            { item_name: "C", price: -10 },
            { item_name: "D", price: "liên hệ" },
          ],
        },
      ],
    });
    const prices = out.categories[0].items.map((i) => i.price);
    expect(prices).toEqual([null, 50000, null, null]);
  });

  it("trim tên + dedup item trong cùng nhóm (không phân biệt hoa/thường)", () => {
    const out = normalizeParsedMenu({
      categories: [
        {
          category_name: "  Trà sữa  ",
          items: [
            { item_name: " Trân châu " },
            { item_name: "trân châu" },
            { item_name: "Trân Châu" },
          ],
        },
      ],
    });
    expect(out.categories[0].categoryName).toBe("Trà sữa");
    expect(out.categories[0].items).toHaveLength(1);
    expect(out.categories[0].items[0].name).toBe("Trân châu");
  });

  it("bỏ nhóm không tên hoặc không có item hợp lệ", () => {
    const out = normalizeParsedMenu({
      categories: [
        { category_name: "", items: [{ item_name: "X" }] },
        { category_name: "Rỗng", items: [{ item_name: "  " }] },
        { category_name: "Có món", items: [{ item_name: "Y" }] },
      ],
    });
    expect(out.categories).toHaveLength(1);
    expect(out.categories[0].categoryName).toBe("Có món");
  });

  it("input không hợp lệ → categories rỗng", () => {
    expect(normalizeParsedMenu(null).categories).toEqual([]);
    expect(normalizeParsedMenu({}).categories).toEqual([]);
    expect(normalizeParsedMenu({ categories: "x" }).categories).toEqual([]);
  });
});
