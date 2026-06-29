# 03 — Repo SQL + authz đơn + validate input

## Vì sao
Tách lớp dữ liệu (SQL) + phân quyền + validate khỏi route để route mỏng và test được DB thật.
Đây là nơi enforce 2 MUST quan trọng: **tham số hoá SQL** và **lấy giá server-side** (không tin
client). `pg_notify` để chừa hook ở task 05 nối vào (chưa cần bus ở task này).

## Việc
- **Bổ sung kiểu (additive):** thêm `restaurantId: string` vào `Order` ở `app/src/lib/orders/types.ts`
  (seller lọc theo quán bằng id thay vì tên). Không phá field sẵn có.
- `app/src/lib/orders/authz.ts` (tái dùng `canEdit`/`AuthzError` ở `src/lib/authz.ts`):
  - `isSellerOf(user, restaurantId)` → gọi lại `canEdit`.
  - `canViewOrder(user, order)` → buyer của đơn / seller của `order.restaurant_id` / admin.
  - `assertCanAct(user, order, toStatus)` → `canTransition` (task 02) + `user` thuộc
    `allowedActors(toStatus)` (buyer là chủ đơn / seller của quán); sai → ném `AuthzError(403…)`.
- `app/src/lib/orderValidate.ts` (theo style `src/lib/adminValidate.ts`):
  - validate `fulfillment_type ∈ {delivery,pickup}`, `buyer_phone` (SDT VN), `items` (mảng
    `{menuItemId, quantity}`, quantity nguyên > 0, không rỗng), `note` optional.
  - delivery: **bắt buộc** `lat`/`lng` hợp lệ + `address`; pickup: bỏ qua các field giao hàng.
- `app/src/lib/orders/repo.ts` (mọi SQL qua `query()`/`withTransaction()`, `$1,$2…`):
  - `toOrder(row): Order` — **map DB → kiểu `Order` sẵn có** mà component dùng: bigint→string `id`
    + `restaurantId`, JOIN `restaurants.name`→`restaurantName`, `name_snapshot`→`name`,
    `created_at`→ISO `createdAt`, gộp items/events. Mọi nơi trả `Order` qua hàm này.
  - `createOrder(buyerId, input)` — `withTransaction`:
    - SELECT `id, name, price, restaurant_id, is_available` từ `menu_items` theo `menuItemId = ANY($1)`;
      kiểm mọi món thuộc đúng `restaurant_id`, còn `is_available`, **giá lấy từ DB** (snapshot).
    - INSERT `orders` (tính `total_amount` = Σ price·qty) + `order_items` + `order_events('pending')`.
    - gọi `notifyOrder(q, payload)` (placeholder — task 05 hiện thực; tạm `SELECT pg_notify('order_channel',$1)`).
  - `getOrderFull(id)`, `listOrdersForBuyer(buyerId)`,
    `listOrdersForSeller(user, restaurantId?)` (JOIN `restaurant_owners`; admin thấy tất cả; lọc theo
    `restaurantId` nếu có), `pendingCountForSeller(user)` (đếm `status='pending'` cho badge side menu).
  - `advanceStatus(order, toStatus, actorId, note?)` — `withTransaction`: UPDATE `status`+`updated_at`
    + INSERT `order_events` + notify; trả `toOrder` mới.
- `app/src/lib/orders/repo.test.ts` — integration **Postgres thật** (§6):
  - createOrder → kiểm rows orders/items/events + `total_amount` đúng; giá lấy từ DB kể cả khi
    input gửi giá sai.
  - advanceStatus đi đúng chuỗi cho delivery & pickup; transition sai bị chặn (qua `assertCanAct`).
  - `listOrdersForSeller`/`pendingCountForSeller` chỉ trả đơn của quán user sở hữu.

## Done khi
- `pnpm test` xanh gồm `repo.test.ts` chạy trên test DB.
- Không có chuỗi SQL nội suy biến (chỉ `$n`); giá luôn từ `menu_items`.
- `toOrder` trả đúng hình dạng `Order` để UI dùng không cần sửa component.
- `canViewOrder`/`assertCanAct` chặn đúng user lạ và transition sai.
