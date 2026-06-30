# 01 — lib `owners.ts`: list / assign / remove

## Vì sao

Gom toàn bộ logic owner vào một lib testable; route chỉ còn validate + gọi. Cần hàm đọc list
để RSC render, và hàm remove (kèm hạ role) cho DELETE.

## Việc

File mới `app/src/lib/owners.ts` (mọi query qua `query()`, tham số hoá):

- `export type Owner = { id: number; name: string | null; email: string }`.
- `listRestaurantOwners(restaurantId: number): Promise<Owner[]>`
  - `SELECT u.id, u.name, u.email FROM restaurant_owners ro JOIN users u ON u.id = ro.user_id
     WHERE ro.restaurant_id = $1 ORDER BY u.email ASC`.
  - Ép `id` sang `number` (pg trả BIGINT dạng string).
- `assignRestaurantOwner(restaurantId: number, email: string): Promise<void>`
  - **Dời logic từ POST hiện tại** (`owners/route.ts`): tìm user theo `email` (lowercase) —
    nếu không có, ném lỗi để route trả 404 "Email chưa từng đăng nhập hệ thống"
    (dùng `AuthzError(404, …)` hoặc một error type rõ ràng, miễn route map đúng status).
  - `INSERT INTO restaurant_owners (restaurant_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`.
  - `UPDATE users SET role='owner' WHERE id=$1 AND role='user'`.
- `removeRestaurantOwner(restaurantId: number, userId: number): Promise<void>`
  - `DELETE FROM restaurant_owners WHERE restaurant_id=$1 AND user_id=$2`.
  - Hạ role nếu hết quán: `UPDATE users SET role='user' WHERE id=$2 AND role='owner'
      AND NOT EXISTS (SELECT 1 FROM restaurant_owners WHERE user_id=$2)`.
  - **Không** đụng user role='admin'.

Test mới `app/src/lib/owners.test.ts` (integration, **Postgres thật** — xem `repo.test.ts` để biết
cách setup/cleanup DB hiện có):
- Seed 2 user (role 'user') + 1 quán.
- `assignRestaurantOwner` cả 2 → cả 2 lên role 'owner'; `listRestaurantOwners` trả 2 dòng,
  sort theo email, field đúng.
- `removeRestaurantOwner` 1 user → còn 1 dòng; user bị gỡ (hết quán) hạ về 'user'; user còn lại giữ 'owner'.
- Seed thêm 1 user role 'admin' có dòng owner → remove KHÔNG hạ admin.

## Done khi

- `pnpm test` (từ `app/`) cho `owners.test.ts` xanh trên Postgres thật.
- Không còn nội suy chuỗi vào SQL; tất cả tham số hoá.
