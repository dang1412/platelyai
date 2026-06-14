import { GoogleGenAI, Type } from "@google/genai";
import type { FoodCategory, ParsedQuery } from "./types";

// Bước 1 — parse câu tự nhiên → ParsedQuery (6 yếu tố) bằng Gemini.
// Vd: "phở bò ngon gần Vincom Bà Triệu dưới 50k"
//   → { category:"food", dishes:["phở bò"], tags:[], location:"Vincom Bà Triệu",
//       maxPrice:50000, wantsCheap:false }
// Xem plans/01_1_extract.md.

const MODEL = "gemini-2.5-flash-lite";

// JSON thô Gemini trả về (trước khi chuẩn hoá).
type RawExtraction = {
  category?: string | null;
  dishes?: string[];
  tags?: string[];
  location?: string | null;
  max_price?: number | null;
  wants_cheap?: boolean;
};

function fallback(): ParsedQuery {
  return {
    category: null,
    dishes: [],
    tags: [],
    location: null,
    maxPrice: null,
    wantsCheap: false,
  };
}

function normalizeCategory(v: unknown): FoodCategory | null {
  const s = typeof v === "string" ? v.toLowerCase().trim() : "";
  return s === "food" || s === "drink" ? s : null;
}

function normalizeMaxPrice(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

function uniqueStrings(arr: string[]): string[] {
  return [...new Set(arr)];
}

// Chuẩn hoá JSON thô → ParsedQuery. THUẦN (không gọi mạng) để test trực tiếp.
// vocabTags = vibe tag hợp lệ (bảng tags); chỉ giữ tag nằm trong đó, trả về đúng dạng canonical.
export function parseExtraction(
  raw: RawExtraction | null | undefined,
  vocabTags: string[],
): ParsedQuery {
  if (!raw || typeof raw !== "object") return fallback();

  // lowercased(tag) → canonical(tag) để khớp không phân biệt hoa/thường nhưng trả về dạng chuẩn.
  const canon = new Map(
    vocabTags.map((t) => [t.toLowerCase().trim(), t.trim()] as const),
  );

  const dishes = uniqueStrings((raw.dishes ?? []).map((d) => d.trim()).filter(Boolean));
  const tags = uniqueStrings(
    (raw.tags ?? [])
      .map((t) => canon.get(t.toLowerCase().trim()))
      .filter((t): t is string => Boolean(t)),
  );

  return {
    category: normalizeCategory(raw.category),
    dishes,
    tags,
    location: raw.location?.trim() || null,
    maxPrice: normalizeMaxPrice(raw.max_price),
    wantsCheap: Boolean(raw.wants_cheap),
  };
}

function systemInstruction(vocabTags: string[]): string {
  const tagList = vocabTags.length
    ? vocabTags.map((t) => `"${t}"`).join(", ")
    : "(chưa có tag nào — luôn để tags rỗng)";
  return `Bạn trích xuất ý định tìm quán ăn/giải khát từ câu của người dùng (tiếng Việt). Trả về JSON:
- category: "food" nếu tìm ĐỒ ĂN (gồm cả ăn vặt: gà rán, bánh tráng trộn, xúc xích...); "drink" nếu tìm ĐỒ UỐNG/GIẢI KHÁT (cà phê, trà sữa, nước ép) HOẶC TRÁNG MIỆNG (chè, kem, sữa chua); null nếu không rõ.
- dishes: mảng TÊN MÓN CỤ THỂ đủ để tra trong menu (vd ["phở bò","trà sữa trân châu","bún đậu"]). KHÔNG đưa loại CHUNG CHUNG ("cơm","đồ ăn","ăn vặt","đồ uống") vào đây — để rỗng và chỉ set category. [] nếu câu không nhắc món cụ thể.
- tags: ĐẶC ĐIỂM/KHÔNG KHÍ quán, CHỈ chọn ĐÚNG NGUYÊN VĂN trong danh sách: ${tagList}. Map ý người dùng về tag gần nhất; đặc điểm KHÔNG có trong danh sách thì BỎ QUA, không bịa tag mới. [] nếu không có.
- location: tên địa điểm/khu vực user nhắc tới (giữ nguyên như trong câu), null nếu không có. KHÔNG bịa địa điểm.
- max_price: số tiền VND tối đa cho MỘT MÓN nếu user giới hạn giá ("dưới 50k" → 50000, "tầm 30 nghìn" → 30000). null nếu không nhắc giá.
- wants_cheap: true nếu user muốn rẻ/tiết kiệm ("giá rẻ","bình dân","giá sinh viên","càng rẻ càng tốt"); false nếu không.
Không thêm thông tin ngoài câu.`;
}

// Gọi Gemini rồi đưa JSON thô vào parseExtraction. Thiếu key / lỗi / parse fail → fallback
// (downstream rơi vào nhánh QUÁN, rank theo rating — không vỡ).
export async function extractQuery(
  q: string,
  vocabTags: string[],
): Promise<ParsedQuery> {
  if (!process.env.GEMINI_API_KEY || !q.trim()) return fallback();

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: q,
      config: {
        systemInstruction: systemInstruction(vocabTags),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, nullable: true },
            dishes: { type: Type.ARRAY, items: { type: Type.STRING } },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            location: { type: Type.STRING, nullable: true },
            max_price: { type: Type.NUMBER, nullable: true },
            wants_cheap: { type: Type.BOOLEAN },
          },
          required: ["dishes", "tags", "wants_cheap"],
        },
      },
    });

    const text = response.text;
    if (!text) return fallback();
    return parseExtraction(JSON.parse(text) as RawExtraction, vocabTags);
  } catch (e) {
    console.error("extractQuery failed:", e);
    return fallback();
  }
}
