# 03 — `POST /api/admin/restaurants/[id]/menu/parse`

File mới: `src/app/api/admin/restaurants/[id]/menu/parse/route.ts`. `runtime = "nodejs"`.
Mẫu cấu trúc: các route trong `…/restaurants/[id]/items/route.ts`.

## Việc
- `requireIntId(params.id)` → `requireCanEdit(restaurantId)` (lấy luôn `name` quán cho prompt:
  query `restaurants` hoặc dùng `getRestaurantForEdit`).
- `request.formData()`; **validate TRƯỚC khi gọi AI** (AGENTS MUST):
  - field `images`: 1..MAX (MAX=4); mỗi file mime ∈ {image/jpeg, image/png, image/webp};
    size ≤ ~5MB.
  - sai → `ValidationError` (400) — không tốn lời gọi Gemini.
- Đọc mỗi file → `{ data: Buffer.from(await f.arrayBuffer()), mimeType: f.type }`.
- Gọi `parseMenuImages(images, name)` → `Response.json({ categories })` (preview, KHÔNG ghi DB).
- Lỗi thiếu key → 503 `{ error: "Chưa cấu hình AI" }`; lỗi khác → 500.
- Dùng `authzResponse` + `validationResponse` như các route hiện có.

## Done khi
- Upload thử trả JSON đúng cấu trúc `ParsedMenu`; mime/size sai → 400; không quyền → 401/403.

## Commit
https://github.com/dang1412/platelyai/commit/43a4415f20882baf5db3840fcc8ca76816282a8e
