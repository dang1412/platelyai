# 05 — Admin: upload ảnh menu → parse → lưu DB

> Mục tiêu: trong trang sửa quán (`/admin/restaurants/[id]`), admin/owner upload 1–N ảnh
> menu, Gemini Vision đọc ảnh → trả về cấu trúc `categories[].items[]`, admin **xem & sửa
> preview**, bấm lưu → bulk insert vào `menu_categories` + `menu_items` đúng schema hiện tại.

Tham khảo code cũ: `old/scripts/enrich_details_json.py` (prompt Vision sinh
`categories/items/price`) + `old/scripts/import_details.py` (cách map JSON → bảng).
Cổng AI write phải qua người duyệt (xem AGENTS §3 "Edge/AI cost" + validate-at-the-edge).

## 1. Luồng (2 bước, AI không tự ghi DB)

```
[Upload ảnh] --multipart--> POST .../menu/parse  --Gemini Vision--> JSON preview (KHÔNG ghi DB)
                                                                          │
                                                  admin xem/sửa trong UI  │
                                                                          ▼
[Bấm "Lưu menu"] --json--> POST .../menu/import  --validate--> bulk INSERT trong 1 transaction
                                                                          │
                                                                  router.refresh()
                                                                          ▼
                                                         MenuEditor hiển thị để chỉnh tiếp
```

Lý do tách 2 endpoint thay vì parse-rồi-ghi-thẳng:
- Gemini đọc giá/tên hay sai → phải cho người sửa trước khi vào DB (tránh rác).
- `import` nhận JSON đã (có thể) sửa → validate-at-the-edge một chỗ, không tin output AI.

## 2. Backend

### 2.1 `src/lib/menuParse.ts` (logic thuần + gọi Gemini, có test)
- `MODEL = "gemini-2.5-flash"` (Vision; `flash-lite` trong extract.ts không nhận ảnh tốt).
- `export type ParsedMenu = { categories: { categoryName: string; kind: MenuKind|null;
  items: { name: string; price: number|null; description: string|null }[] }[] }`.
- `parseMenuImages(images: { data: Buffer; mimeType: string }[], restaurantName: string):
  Promise<ParsedMenu>`:
  - Dựng `contents` = các `inlineData` (base64 ảnh) + 1 part text prompt — theo SDK
    `@google/genai` v2 đã dùng ở `extract.ts` (`ai.models.generateContent`).
  - `config.responseMimeType="application/json"` + `responseSchema` (Type.OBJECT…) ép cấu trúc
    `categories/items` y như prompt `PROMPT_WITH_IMAGES` của `enrich_details_json.py`
    (giữ nguyên rule: `price` integer VNĐ, không đọc được → null; description ngắn hoặc rỗng).
  - Thiếu `GEMINI_API_KEY` → ném lỗi rõ (route trả 503), **không** fallback rỗng âm thầm.
- `export function normalizeParsedMenu(raw): ParsedMenu` — THUẦN, không mạng → unit test:
  trim tên, bỏ category/item rỗng, ép `price` về integer≥0 hoặc null, dedup item trong cùng
  nhóm, suy `kind` thô (drink nếu category_name khớp "đồ uống|cà phê|trà|nước…", else food).
  Test ở `src/lib/menuParse.test.ts` (giống `extract.test.ts`, mock JSON thô).

### 2.2 `POST /api/admin/restaurants/[id]/menu/parse/route.ts`
- `runtime = "nodejs"`.
- `requireIntId(params.id)` → `requireCanEdit(restaurantId)` (lấy luôn tên quán cho prompt).
- Đọc `multipart/form-data` (`request.formData()`); validate **trước khi gọi AI**:
  - field `images` (1..MAX). MAX = 4 ảnh, mỗi ảnh ≤ ~5MB, mime ∈ {jpeg,png,webp}.
  - sai số lượng / mime / size → `ValidationError` → 400 (không tốn 1 lời gọi Gemini).
- Gọi `parseMenuImages(...)` → trả `{ categories }` (JSON preview, **không** chạm DB).
- Lỗi key → 503 `{ error: "Chưa cấu hình AI" }`; lỗi khác → 500.

### 2.3 `POST /api/admin/restaurants/[id]/menu/import/route.ts`
- `requireIntId` + `requireCanEdit`.
- Body = `{ categories: [{ category_name, kind, display_order?, items: [{ name, price,
  description }] }] }` (chính là preview admin đã sửa). Validate từng field bằng helper sẵn có
  trong `adminValidate.ts` (`requireText`, `optionalPrice`, `optionalText`, `optionalKind`),
  bỏ qua category không có item. Chặn rỗng/ngoài range → 400.
- **Merge/upsert trong 1 transaction** (xem 2.4) — không tạo trùng menu cũ:
  - **Category:** match theo `(restaurant_id, lower(category_name))`. Có sẵn → tái dùng `id`
    (cập nhật `kind` nếu trước đó NULL mà giờ có). Chưa có → `INSERT … RETURNING id`.
  - **Item:** match theo `(restaurant_id, normalized_name)` = `lower(unaccent(name))`. Quy tắc:
    - **Có sẵn → UPDATE** `price` (nếu input có giá; giá null từ AI thì giữ giá cũ),
      `description` (nếu input non-null), gắn `category_id` về nhóm vừa khớp/insert,
      `updated_at = now()`. **Không** đụng `embedding` (tên không đổi nên vẫn đúng).
    - **Chưa có → INSERT** như route items hiện tại (`normalized_name = lower(unaccent($n))`,
      `embedding` NULL — re-embed offline sau; AGENTS §3).
  - Match item theo restaurant (không bó theo category) để món đổi nhóm vẫn nhận ra là cũ →
    chỉ cập nhật giá + chuyển nhóm, không nhân bản. Nhiều dòng cùng `normalized_name` (dữ
    liệu cũ có trùng) → cập nhật dòng `id` nhỏ nhất, để yên phần còn lại (đừng tự xoá).
  - **Món có trong menu cũ nhưng KHÔNG có trong ảnh lần này → để nguyên** (không xoá, không
    `is_available=false`). Import chỉ thêm mới + cập nhật món khớp, tuyệt đối không đụng món
    không xuất hiện trong payload.
- Không có unique index trên `menu_items` → **không** dùng `ON CONFLICT`; làm SELECT-rồi-
  UPDATE/INSERT bên trong transaction (đã khoá theo restaurant nên không đua).
- Trả `{ categories: n, itemsInserted: a, itemsUpdated: b }`.

### 2.4 Transaction helper trong `src/lib/db.ts`
`query()` hiện chỉ chạy 1 câu, không tái dùng được cho bulk-insert nguyên tử. Thêm:
```ts
export async function withTransaction<T>(fn: (q: ClientQuery) => Promise<T>): Promise<T>
```
- `pool.connect()` → `BEGIN` → chạy `fn` (truyền 1 hàm query bám trên client đó) →
  `COMMIT`; lỗi → `ROLLBACK` + rethrow; `finally client.release()`.
- Vẫn tham số hoá `$1,$2…` (AGENTS MUST). Dùng riêng cho `menu/import`.

## 3. Frontend

### 3.1 `src/components/admin/MenuImport.tsx` (`"use client"`)
- Đặt trong section "Menu" của `admin/restaurants/[id]/page.tsx`, **trên** `<MenuEditor>`
  (collapsible "Nhập menu từ ảnh").
- State: `files`, `parsing`, `preview: ParsedMenu | null`, `saving`, `error`.
- `<input type="file" accept="image/*" multiple>` → POST `multipart` tới `…/menu/parse`
  (fetch trực tiếp, **không** dùng `adminFetch` vì nó set JSON header; thêm overload hoặc
  fetch thẳng).
- Hiện preview có thể sửa: list nhóm → item (tên/giá/mô tả editable, xoá được, đổi `kind`).
  Tái dùng style field/token như `MenuEditor`/`ItemRow` (không hardcode hex — AGENTS §5).
- "Lưu menu" → POST JSON `…/menu/import` → `router.refresh()` → menu mới hiện ở `MenuEditor`,
  reset preview.

### 3.2 `adminFetch.ts`
Hỗ trợ body `FormData` (không ép `Content-Type: application/json` khi body là FormData) —
hoặc để `MenuImport` fetch thẳng cho bước parse. Chọn cách ít sửa nhất.

## 4. Schema
Không cần đổi schema — `menu_categories`/`menu_items` đã đủ (`kind`, `display_order`,
`is_available`, `normalized_name`, `embedding` nullable). **Additive-only** nếu sau này cần
lưu ảnh nguồn (cột `source_image_url`) — không làm trong scope này.

## 5. File đụng tới
| File | Việc |
| --- | --- |
| `src/lib/menuParse.ts` (+ `.test.ts`) | prompt Vision + normalize (mới) |
| `src/lib/db.ts` | thêm `withTransaction` |
| `src/app/api/admin/restaurants/[id]/menu/parse/route.ts` | mới |
| `src/app/api/admin/restaurants/[id]/menu/import/route.ts` | mới |
| `src/components/admin/MenuImport.tsx` | UI upload + preview (mới) |
| `src/app/admin/restaurants/[id]/page.tsx` | gắn `<MenuImport>` vào section Menu |
| `src/components/admin/adminFetch.ts` | hỗ trợ FormData (nếu cần) |
| `.env.example` | `GEMINI_API_KEY` đã có — không đổi |

## 6. Test & guardrails
- Unit: `normalizeParsedMenu` (giá rác/null, dedup, kind suy ra, bỏ nhóm rỗng) — không cần DB.
- Integration (DB thật, AGENTS §6): `menu/import`
  - insert mới đúng category+item, gắn đúng `restaurant_id`;
  - **upsert**: import lại món đã có (cùng `normalized_name`) → UPDATE giá, **không** tạo dòng
    mới; giá null từ input → giữ giá cũ; item đổi nhóm → chuyển `category_id`, không nhân bản;
  - tái dùng category khi trùng `category_name` (không tạo nhóm trùng);
  - transaction rollback khi 1 item lỗi.
- MUST: validate ảnh (số lượng/mime/size) **trước** khi gọi Gemini; validate JSON ở `import`
  trước khi chạm DB; mọi insert tham số hoá; gọi Gemini đúng 1 lần/parse (không trong vòng lặp).
- `pnpm lint && pnpm test && pnpm build` xanh trước PR. Branch `feat/admin-menu-parse`.

## 7. Mở rộng (ngoài scope, ghi để nhớ)
- Nút "Thay thế toàn bộ menu" (xoá cũ rồi import) — mặc định hiện tại là merge/upsert,
  món cũ không có trong ảnh được giữ nguyên.
- Lưu ảnh menu lên object storage + `source_image_url`.
- Tự sinh embedding cho item mới (hiện để NULL, re-embed offline như plan 04).
