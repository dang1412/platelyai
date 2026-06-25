# 04 — `POST /api/admin/restaurants/[id]/menu/import` (merge/upsert)

File mới: `src/app/api/admin/restaurants/[id]/menu/import/route.ts`. Phụ thuộc task 01
(`withTransaction`). `runtime = "nodejs"`.

## Việc
- `requireIntId` + `requireCanEdit`.
- Body `{ categories: [{ category_name, kind, display_order?, items: [{ name, price, description }] }] }`
  = preview admin đã sửa. Validate từng field bằng `adminValidate.ts`
  (`requireText`, `optionalKind`, `optionalPrice`, `optionalText`, `optionalOrder`); bỏ category
  không có item; rỗng/ngoài range → 400 (validate-at-the-edge trước khi chạm DB).
- **Trong `withTransaction`:**
  - **Category:** match `(restaurant_id, lower(category_name))`. Có → tái dùng `id` (UPDATE
    `kind` nếu trước NULL & giờ có). Chưa → INSERT … RETURNING id.
  - **Item:** match `(restaurant_id, normalized_name)` với `normalized_name = lower(unaccent(name))`:
    - Có → **UPDATE** `price` (chỉ khi input có giá; null → giữ giá cũ), `description` (khi
      input non-null), gán `category_id` về nhóm vừa khớp, `updated_at = now()`. KHÔNG đụng
      `embedding`. Trùng nhiều dòng → cập nhật `id` nhỏ nhất, để yên phần còn lại.
    - Chưa → **INSERT** (như route items: `lower(unaccent($n))`, `embedding` NULL).
  - **Món cũ không có trong payload → để nguyên** (không xoá, không tắt).
- Trả `{ categories, itemsInserted, itemsUpdated }`.
- Không dùng `ON CONFLICT` (không có unique index) — SELECT rồi UPDATE/INSERT trong transaction.

## Test (DB thật — AGENTS §6) `…/menu/import`
- insert mới đúng `restaurant_id` + category + item.
- upsert: import lại món cùng `normalized_name` → UPDATE giá, không tạo dòng mới.
- giá null trong input → giữ giá cũ.
- item đổi nhóm → chỉ chuyển `category_id`, không nhân bản.
- category trùng tên → tái dùng, không tạo nhóm trùng.
- món cũ vắng mặt trong payload → còn nguyên.
- 1 item lỗi → rollback toàn bộ.

## Done khi
- Các ca test trên xanh.
