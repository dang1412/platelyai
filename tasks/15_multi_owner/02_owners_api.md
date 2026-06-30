# 02 — API: refactor POST + thêm DELETE

## Vì sao

Route cần dùng lib mới (DRY) và có endpoint gỡ owner cho UI.

## Việc

Sửa `app/src/app/api/admin/restaurants/[id]/owners/route.ts` (giữ `runtime="nodejs"`):

- **POST** (refactor, giữ hành vi):
  - Validate: `requireIntId(id)`; `getCurrentUser()` → 401 nếu chưa login; `role==='admin'` else 403.
  - `requireText(body.email, "Email").toLowerCase()`.
  - Kiểm quán tồn tại (giữ 404 "Không tìm thấy quán") rồi gọi `assignRestaurantOwner(id, email)`.
  - Map lỗi "email chưa đăng nhập" → 404 như cũ. Trả `{ ok: true }` 201.
- **DELETE** (mới):
  - Cùng guard validate + chỉ admin.
  - `const userId = requireIntId(body.userId, "userId")`.
  - Gọi `removeRestaurantOwner(id, userId)` → `{ ok: true }` (idempotent, 200).
- Giữ pattern bắt lỗi cuối: `authzResponse(err) ?? validationResponse(err) ?? 500`.

## Done khi

- POST hành vi không đổi (vẫn 201 / 404 / 403 / 401 / 400 đúng như trước).
- DELETE xoá owner; gọi lại với userId không tồn tại vẫn 200 (idempotent).
- Validate `id` + `userId` + `email` trước khi chạm DB; chỉ admin qua được.
- Thử tay bằng `curl`/devtools: gán rồi gỡ một owner thấy DB cập nhật.
