# 03 — Repo SQL + authz đơn + validate input

## Vì sao
Tách lớp dữ liệu (SQL) + phân quyền + validate khỏi route để route mỏng và test được DB thật.
Đây là nơi enforce 2 MUST quan trọng: **tham số hoá SQL** và **lấy giá server-side** (không tin
client). `pg_notify` để chừa hook ở task 05 nối vào (chưa cần bus ở task này).

## Việc
- `app/src/lib/orders/authz.ts` (tái dùng `canEdit`/`AuthzError` ở `src/lib/authz.ts`):
  - `isSellerOf(user, restaurantId)` → gọi lại `canEdit`.
  - `canViewOrder(user, order)` → buyer của đơn / seller của `order.restaurant_id` / admin.
  - `assertCanAct(user, order, toStatus)` → `canTransition` (task 02) + actor (`actorFor`) khớp
    `user` (buyer vs seller); sai → ném `AuthzError(403…)`.
- `app/src/lib/orderValidate.ts` (theo style `src/lib/adminValidate.ts`):
  - validate `fulfillment_type ∈ {delivery,pickup}`, `buyer_phone` (SDT VN), `items` (mảng
    `{menuItemId, quantity}`, quantity nguyên > 0, không rỗng), `note` optional.
  - delivery: **bắt buộc** `lat`/`lng` hợp lệ + `address`; pickup: bỏ qua các field giao hàng.
- `app/src/lib/orders/repo.ts` (mọi SQL qua `query()`/`withTransaction()`, `$1,$2…`):
  - `createOrder(buyerId, input)` — `withTransaction`:
    - SELECT `id, name, price, restaurant_id, is_available` từ `menu_items` theo `menuItemId = ANY($1)`;
      kiểm mọi món thuộc đúng `restaurant_id`, còn `is_available`, **giá lấy từ DB** (snapshot).
    - INSERT `orders` (tính `total_amount` = Σ price·qty) + `order_items` + `order_events('pending')`.
    - gọi `notifyOrder(q, payload)` (placeholder import từ `realtime/bus` — task 05 hiện thực; tạm
      có thể `SELECT pg_notify('order_channel', $1)` trực tiếp rồi task 05 refactor).
  - `getOrderFull(id)` (order + items + events), `listOrdersForBuyer(buyerId)`,
    `listActiveOrdersForSeller(user)` (JOIN `restaurant_owners`; admin thấy tất cả).
  - `advanceStatus(order, toStatus, actorId, note?)` — `withTransaction`: UPDATE `status`+`updated_at`
    + INSERT `order_events` + notify; trả order mới.
- `app/src/lib/orders/repo.test.ts` — integration **Postgres thật** (§6):
  - createOrder → kiểm rows orders/items/events + `total_amount` đúng; giá lấy từ DB kể cả khi
    input gửi giá sai.
  - advanceStatus đi đúng chuỗi cho delivery & pickup; transition sai bị chặn (qua `assertCanAct`).

## Done khi
- `pnpm test` xanh gồm `repo.test.ts` chạy trên test DB.
- Không có chuỗi SQL nội suy biến (chỉ `$n`); giá luôn từ `menu_items`.
- `canViewOrder`/`assertCanAct` chặn đúng user lạ và transition sai.
