# Plan 01.1 — Extract (parse query → 6 yếu tố)

> Bước 1 của [Search API](./01_search_api.md). File: `app/src/lib/extract.ts` (+ `types.ts`).
> Trạng thái: **✅ xong** — 13/13 unit test xanh, typecheck sạch. Integration (Gemini thật) để kiểm tay khi có key.

## Mục tiêu

Biến câu tự nhiên của user thành `ParsedQuery` có cấu trúc bằng 1 lần gọi Gemini.

## Input / Output

```ts
function extractQuery(q: string, vocabTags: string[]): Promise<ParsedQuery>
```

- `q`: câu user gõ. `vocabTags`: danh sách vibe tag hợp lệ (nạp từ bảng `tags`), để giới hạn yếu tố 3.

```ts
type ParsedQuery = {
  category: "food" | "drink" | null; // 1
  dishes: string[];                  // 2
  tags: string[];                    // 3 — đã validate, chỉ chứa tag trong vocabTags
  location: string | null;           // 4
  maxPrice: number | null;           // 5 — VND, giá tối đa MỘT món
  wantsCheap: boolean;               // 6
};
```

## Thiết kế

- **Gemini** `gemini-2.5-flash-lite`, `responseMimeType: application/json` + `responseSchema` ép đúng
  6 trường. System prompt mô tả từng trường (tiếng Việt) — port gọn từ `old/app/src/lib/extract.ts`.
- **Vocab tag nhồi động**: prompt liệt kê `vocabTags`; Gemini chỉ được chọn trong đó. Output vẫn
  **validate lại** bằng `Set(vocabTags)` (Gemini có thể bịa). `vocabTags` rỗng → `tags` luôn `[]`.
- **`wantsCheap`**: lấy trực tiếp từ Gemini (`wants_cheap`) — nhận diện "rẻ", "giá sinh viên",
  "bình dân", "tầm trung"… Không suy ra từ sort như code cũ.
- **Tách core thuần để test**: `parseExtraction(raw, vocabTags) → ParsedQuery` (không gọi mạng).
  `extractQuery` chỉ lo gọi Gemini rồi đưa JSON thô vào `parseExtraction`.
- **Fallback** (thiếu `GEMINI_API_KEY` hoặc lỗi/parse fail): trả
  `{ category:null, dishes:[], tags:[], location:null, maxPrice:null, wantsCheap:false }`.
  → downstream rơi vào nhánh QUÁN, rank theo rating (không vỡ).

### Chuẩn hoá trong `parseExtraction`
- `category`: chỉ nhận `"food"|"drink"`, còn lại → `null`.
- `dishes`: trim, bỏ rỗng.
- `tags`: lowercase + trim, **giữ tag có trong `vocabTags`**.
- `maxPrice`: chỉ nhận số hữu hạn > 0, còn lại → `null`.
- `wantsCheap`: ép `Boolean`.

## Test (`app/src/lib/extract.test.ts`, vitest)

Test **`parseExtraction`** (thuần, không cần API key) — bảng case:

| Input JSON thô (Gemini giả lập) | vocab | Kỳ vọng |
|---|---|---|
| `{category:"food",dishes:["phở bò"],tags:["bình dân"],location:"Vincom",max_price:50000,wants_cheap:true}` | `["bình dân","cà phê"]` | đủ 6 trường, tags=`["bình dân"]` |
| `{category:"drink",dishes:["chè"],tags:[],location:null,max_price:null,wants_cheap:false}` | `[]` | category="drink", tags=`[]` |
| `category:"đồ ăn"` (sai enum) | — | category=`null` |
| `tags:["view đẹp","cà phê"]` | `["cà phê"]` | tags=`["cà phê"]` (loại "view đẹp" ngoài vocab) |
| `tags:["Cà Phê"]` (hoa) | `["cà phê"]` | tags=`["cà phê"]` (case-insensitive) |
| `dishes:[" phở "," "]` | — | dishes=`["phở"]` (trim + bỏ rỗng) |
| `max_price:0` / `max_price:-1` / `max_price:"x"` | — | maxPrice=`null` |
| `{}` (thiếu hết) | — | = fallback |

Test **fallback**: `parseExtraction(null, [...])` → object fallback.

Integration (tuỳ chọn, `describe.skipIf(!GEMINI_API_KEY)`): gọi Gemini thật với vài câu mẫu, chỉ
assert **shape** + invariant (vd "phở bò gần X dưới 40k" → dishes không rỗng, maxPrice=40000,
location chứa "X").

## Done khi
- `pnpm test extract` xanh (unit core + fallback).
- `extractQuery` chạy được với key thật (kiểm 1-2 câu thủ công).
