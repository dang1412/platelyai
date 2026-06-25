# 02 — `src/lib/menuParse.ts` (Gemini Vision + normalize)

Tham khảo prompt: `old/scripts/enrich_details_json.py` (`PROMPT_WITH_IMAGES`).
Tham khảo SDK call: `src/lib/extract.ts` (`@google/genai` v2, `ai.models.generateContent`).

## Việc
- `MODEL = "gemini-2.5-flash"` (Vision — KHÔNG dùng `flash-lite`).
- Types:
  ```ts
  export type ParsedItem = { name: string; price: number | null; description: string | null };
  export type ParsedCategory = { categoryName: string; kind: MenuKind | null; items: ParsedItem[] };
  export type ParsedMenu = { categories: ParsedCategory[] };
  ```
- `parseMenuImages(images: { data: Buffer; mimeType: string }[], restaurantName: string): Promise<ParsedMenu>`
  - `contents` = các part `inlineData` (base64 ảnh) + 1 part text prompt (tên quán nhúng vào).
  - `config.responseMimeType="application/json"` + `responseSchema` ép `categories/items`
    (price integer VNĐ hoặc null, description ngắn hoặc rỗng).
  - Thiếu `GEMINI_API_KEY` → **throw** lỗi rõ (route map sang 503), KHÔNG fallback rỗng.
  - Trả `normalizeParsedMenu(JSON.parse(text))`.
- `export function normalizeParsedMenu(raw: unknown): ParsedMenu` — **THUẦN** (no network):
  trim tên; bỏ category/item rỗng; ép `price` về integer ≥ 0 hoặc null; dedup item trong cùng
  nhóm (theo `lower(trim(name))`); suy `kind` thô (drink nếu `categoryName` khớp
  `đồ uống|cà phê|trà|nước|sinh tố|bia|rượu`, else food).

## Test — `src/lib/menuParse.test.ts` (giống `extract.test.ts`)
- normalize: giá rác/null → null; dedup; bỏ nhóm rỗng; suy `kind` đúng vài ca.
- KHÔNG gọi mạng trong test (chỉ test `normalizeParsedMenu`).

## Done khi
- `pnpm test` xanh; `parseMenuImages` type khớp cách dùng ở task 03.

## Commit
https://github.com/dang1412/platelyai/commit/c2f045ff757ee9cf114ef4a15851402eab3f725e
