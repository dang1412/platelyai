# 04 — API route /api/profile (GET/PUT)

> Commit: 3eadde2 — feat(profile): API route GET/PUT /api/profile ✅

## Vì sao

Endpoint cho trang profile load + lưu; cũng được form đặt món gọi để prefill.

## Việc

- Tạo `app/src/app/api/profile/route.ts`, `export const runtime = "nodejs"`.
- `GET`:
  - `getCurrentUser()`; null → `AuthzError(401, "Chưa đăng nhập")`.
  - `const profile = await getBuyerProfile(user.id)` → `Response.json({ profile })`.
- `PUT`:
  - `getCurrentUser()`; null → 401.
  - `const body = await request.json().catch(() => ({}))`.
  - `const input = parseBuyerProfile(body)` (validate TRƯỚC khi DB — MUST).
  - `await upsertBuyerProfile(user.id, input)` → `Response.json({ profile: input })`.
- Bắt lỗi: `authzResponse(err) ?? validationResponse(err) ?? Response.json({ error: "Lỗi máy chủ" }, { status: 500 })` — y như `api/orders/route.ts`.

## Done khi

- GET trả `{ profile }`; PUT validate → upsert → trả `{ profile }`.
- Chưa đăng nhập → 401; body sai → 400; happy path → 200.
- Thử tay bằng đăng nhập + gọi GET/PUT (hoặc qua trang ở task 05).
