# 03 — POST /api/admin/restaurants (tạo quán)

## Vì sao
Cần endpoint tạo quán mới, chỉ cho admin, insert kèm toạ độ (cột PostGIS `location`).

## Việc
- `app/src/app/api/admin/restaurants/route.ts`: thêm `export async function POST(request)`.
  - **Authz (MUST):** `getCurrentUser()`; `!user` → `AuthzError(401,…)`;
    `user.role !== "admin"` → `AuthzError(403, "Chỉ admin được tạo quán")`.
  - **Validate (MUST):** `name = requireText`; `address/phone/website = optionalText`;
    `serves_food/serves_drink = optionalBool(..., false)`;
    `{ lat, lng } = optionalLatLng(body.lat, body.lng)`.
  - **SQL (MUST param hoá):** INSERT vào `restaurants` (name, address, phone, website,
    serves_food, serves_drink, lat, lng, location, source='admin'), với
    `location = CASE WHEN $7 IS NULL OR $8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($8,$7),4326)::geography END`
    — **thứ tự (lng, lat)** trong `ST_MakePoint`. `RETURNING id`.
  - Trả `Response.json({ id }, { status: 201 })`.
  - Bắt lỗi: `authzResponse(err) ?? validationResponse(err) ?? 500`.
- Giữ `export const runtime = "nodejs"` (đã có).

## Done khi
- Non-admin → 403; chưa login → 401; thiếu name → 400.
- Tạo có toạ độ → row có `location` (ST_X = lng, ST_Y = lat); tạo không toạ độ → location NULL.
- Trả `{ id }` 201.

## Commit
https://github.com/dang1412/platelyai/commit/da30797
