import { GoogleGenAI, Type } from "@google/genai";
import { buildKey, getOrCompute } from "./extractCache";
import type { ParsedQuery } from "./types";

// Bước 1 — parse câu tự nhiên → ParsedQuery bằng Gemini.
// Vd: "phở bò ngon gần Vincom Bà Triệu dưới 50k"
//   → { dishes:["phở bò"], tags:[], location:"Vincom Bà Triệu", maxPrice:50000, wantsCheap:false }
// Trục food/drink KHÔNG còn field category (plan 09): khi KHÔNG có món cụ thể, Gemini gắn type-tag
// "quán ăn"/"giải khát" vào tags. Xem plans/01_1_extract.md, plans/09_type_tags.md.

const MODEL = "gemini-2.5-flash-lite";

// JSON thô Gemini trả về (trước khi chuẩn hoá).
type RawExtraction = {
  dishes?: string[];
  tags?: string[];
  location?: string | null;
  max_price?: number | null;
  wants_cheap?: boolean;
};

function fallback(): ParsedQuery {
  return {
    dishes: [],
    tags: [],
    location: null,
    maxPrice: null,
    wantsCheap: false,
  };
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
- dishes: mảng TÊN MÓN CỤ THỂ đủ để tra trong menu (vd ["phở bò","trà sữa trân châu","bún đậu"]). KHÔNG đưa loại CHUNG CHUNG ("đồ ăn","ăn vặt","đồ uống") vào đây — để rỗng [] nếu câu không nhắc món cụ thể.
- tags: ĐẶC ĐIỂM/KHÔNG KHÍ quán, CHỈ chọn ĐÚNG NGUYÊN VĂN trong danh sách: ${tagList}. Map ý người dùng về tag gần nhất; đặc điểm KHÔNG có trong danh sách thì BỎ QUA, không bịa tag mới. [] nếu không có.
  Khi dishes RỖNG (không có tên món cụ thể), thêm ĐÚNG 1 tag loại vào tags để phân biệt người dùng muốn ĐỒ ĂN hay GIẢI KHÁT: "quán ăn" HOẶC "giải khát".
- location: tên địa điểm/khu vực user nhắc tới (giữ nguyên như trong câu), null nếu không có. KHÔNG bịa địa điểm.
- max_price: số tiền VND tối đa cho MỘT MÓN nếu user giới hạn giá ("dưới 50k" → 50000, "tầm 30 nghìn" → 30000). null nếu không nhắc giá.
- wants_cheap: true nếu user muốn rẻ/tiết kiệm ("giá rẻ","bình dân","giá sinh viên","càng rẻ càng tốt"); false nếu không.
Không thêm thông tin ngoài câu.`;
}

// Gọi Gemini rồi đưa JSON thô vào parseExtraction. Thiếu key / lỗi / parse fail → fallback
// (downstream rơi vào nhánh QUÁN, rank theo rating — không vỡ).
//
// Cache in-memory theo (q + vocab) qua getOrCompute (plan 08): cùng câu hỏi không gọi lại Gemini
// (ca bật/tắt vị trí re-fetch cùng q; chống "high demand" do trùng lặp/đông người). compute trả
// null khi fallback/lỗi → KHÔNG cache (503 thoáng qua được thử lại lần sau).
export async function extractQuery(
  q: string,
  vocabTags: string[],
): Promise<ParsedQuery> {
  if (!process.env.GEMINI_API_KEY || !q.trim()) return fallback();
  const apiKey = process.env.GEMINI_API_KEY;
  const key = buildKey(q, vocabTags);

  const result = await getOrCompute(key, async () => {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: q,
        config: {
          systemInstruction: systemInstruction(vocabTags),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
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
      if (!text) return null; // không cache khi thiếu output
      return parseExtraction(JSON.parse(text) as RawExtraction, vocabTags);
    } catch (e) {
      console.error("extractQuery failed:", e);
      return null; // lỗi → KHÔNG cache
    }
  });

  return result ?? fallback();
}
