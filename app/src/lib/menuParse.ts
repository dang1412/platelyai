import { GoogleGenAI, Type } from "@google/genai";
import type { MenuKind } from "./adminRestaurant";

// Đọc ảnh menu bằng Gemini Vision → cấu trúc categories[].items[] để admin xem/sửa trước
// khi import vào DB (xem plans/05_admin_menu_parse.md). Prompt tham khảo code cũ
// (old/scripts/enrich_details_json.py); cách gọi SDK theo src/lib/extract.ts.

const MODEL = "gemini-2.5-flash"; // bản Vision — flash-lite ở extract.ts không nhận ảnh tốt.

export type ParsedItem = {
  name: string;
  price: number | null;
  description: string | null;
};
export type ParsedCategory = {
  categoryName: string;
  kind: MenuKind | null;
  items: ParsedItem[];
};
export type ParsedMenu = { categories: ParsedCategory[] };

// JSON thô Gemini trả về (trước khi normalize).
type RawMenu = {
  categories?: {
    category_name?: string | null;
    items?: {
      item_name?: string | null;
      price?: number | string | null;
      description?: string | null;
    }[];
  }[];
};

// Gợi ý drink theo tên nhóm (suy kind thô; admin sửa lại nếu sai).
const DRINK_RE = /đồ uống|thức uống|cà phê|cafe|trà|nước|sinh tố|bia|rượu|cocktail|giải khát/i;

function inferKind(categoryName: string): MenuKind {
  return DRINK_RE.test(categoryName) ? "drink" : "food";
}

// Giá → integer ≥ 0 hoặc null (chấp số hoặc chuỗi số; bỏ ký tự không phải số).
function normalizePrice(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") {
    return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  }
  if (typeof v === "string") {
    const digits = v.replace(/[^\d]/g, "");
    if (!digits) return null;
    const n = Number(digits);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

// Chuẩn hoá JSON thô → ParsedMenu. THUẦN (không gọi mạng) để test trực tiếp.
// Trim tên, bỏ category/item rỗng, dedup item trong cùng nhóm (theo lower(trim(name))).
export function normalizeParsedMenu(raw: unknown): ParsedMenu {
  const r = raw as RawMenu | null | undefined;
  if (!r || typeof r !== "object" || !Array.isArray(r.categories)) {
    return { categories: [] };
  }

  const categories: ParsedCategory[] = [];
  for (const cat of r.categories) {
    const categoryName = (cat?.category_name ?? "").trim();
    if (!categoryName) continue;

    const items: ParsedItem[] = [];
    const seen = new Set<string>();
    for (const it of cat?.items ?? []) {
      const name = (it?.item_name ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const description = (it?.description ?? "").trim() || null;
      items.push({ name, price: normalizePrice(it?.price), description });
    }
    if (items.length === 0) continue;

    categories.push({ categoryName, kind: inferKind(categoryName), items });
  }
  return { categories };
}

function prompt(restaurantName: string): string {
  return `Bạn là chuyên gia ẩm thực Việt Nam. Đây là quán tên "${restaurantName}". Hãy đọc các ảnh menu và trả về JSON với 1 trường "categories":
- "categories": mảng danh mục món, mỗi danh mục gồm:
  - "category_name": tên danh mục (ví dụ "Đồ uống", "Món chính"). Nếu menu không chia nhóm thì tự gom hợp lý.
  - "items": mảng món, mỗi món gồm:
    - "item_name": tên món
    - "price": số nguyên đơn vị VNĐ; nếu không đọc được giá thì để null
    - "description": mô tả ngắn nếu có, không thì để rỗng
Chỉ trả về JSON đúng cấu trúc, không giải thích thêm. Chỉ lấy món thực sự xuất hiện trên ảnh, không bịa.`;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    categories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category_name: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item_name: { type: Type.STRING },
                price: { type: Type.NUMBER, nullable: true },
                description: { type: Type.STRING, nullable: true },
              },
              required: ["item_name"],
            },
          },
        },
        required: ["category_name", "items"],
      },
    },
  },
  required: ["categories"],
};

// Gọi Gemini Vision với 1..N ảnh + tên quán → ParsedMenu (đã normalize).
// Thiếu key → throw rõ ràng để route map sang 503 (KHÔNG fallback rỗng âm thầm).
export async function parseMenuImages(
  images: { data: Buffer; mimeType: string }[],
  restaurantName: string,
): Promise<ParsedMenu> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY chưa cấu hình");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const parts = [
    ...images.map((img) => ({
      inlineData: { data: img.data.toString("base64"), mimeType: img.mimeType },
    })),
    { text: prompt(restaurantName) },
  ];

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: parts,
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) return { categories: [] };
  return normalizeParsedMenu(JSON.parse(text) as RawMenu);
}
