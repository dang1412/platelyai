# 01 — lib `createOwnedRestaurant()`

## Vì sao
Tạo quán self-serve phải làm 3 việc nguyên tử: insert quán, gán creator làm owner, nâng role
`user`→`owner`. Gom vào một lib có transaction để route chỉ validate + gọi, và test được với DB thật.

## Việc
- File mới `app/src/lib/createRestaurant.ts`:
  - `type CreateInput = { ownerId, name, address, phone, website, lat, lng }` (lat/lng nullable).
  - `export async function createOwnedRestaurant(input): Promise<{ id: number }>` dùng
    `withTransaction` từ `@/lib/db`:
    1. `INSERT INTO restaurants (name,address,phone,website,lat,lng,location,source)` với
       `CASE WHEN $5::float8 IS NULL OR $6::float8 IS NULL THEN NULL ELSE`
       `ST_SetSRID(ST_MakePoint($6,$5),4326)::geography END`, `source='user'`, `RETURNING id`.
       (Nhớ `ST_MakePoint(lng, lat)`.)
    2. `INSERT INTO restaurant_owners (restaurant_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`.
    3. `UPDATE users SET role='owner' WHERE id=$1 AND role='user'`.
  - **Không** import `@/lib/authz` / `@/auth` (vitest không nạp được next-auth — xem `owners.ts`).
  - MUST tham số hoá mọi câu.
- File mới `app/src/lib/createRestaurant.test.ts` (integration, Postgres thật):
  - seed 1 user role='user'; gọi `createOwnedRestaurant` có toạ độ → kiểm quán tồn tại,
    `source='user'`, `ST_X(location)=lng`/`ST_Y(location)=lat`, có dòng owner, user role='owner'.
  - case không toạ độ → `location IS NULL`.
  - dọn dữ liệu seed sau test (theo pattern `owners.test.ts`).

## Done khi
- `createOwnedRestaurant` chạy nguyên tử, mọi SQL tham số hoá.
- `pnpm test` (từ `app/`) xanh cho `createRestaurant.test.ts` với Postgres thật.
