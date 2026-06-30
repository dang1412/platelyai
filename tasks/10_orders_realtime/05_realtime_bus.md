# 05 — Realtime bus: Postgres LISTEN/NOTIFY + fan-out

> Commit: 7977f57 — feat(orders): realtime bus LISTEN/NOTIFY + fan-out; repo dùng notifyOrder từ bus (+ integration test) ✅
> Fan-out: buyer + owner của quán (admin xem qua refetch khi mở tab — chưa fan-out tới admin, ghi mở rộng).

## Vì sao
Cần lớp đẩy tín hiệu "đơn X đổi trạng thái" tới đúng buyer/seller đang mở tab, không polling.
Postgres `LISTEN/NOTIFY` cho fan-out đa-instance miễn phí (mỗi instance 1 kết nối LISTEN tới
cùng DB). Cô lập toàn bộ ở 1 file để sau đổi sang Redis/managed không lan ra chỗ khác.

## Việc
- `app/src/lib/realtime/bus.ts` (singleton, pattern `globalThis` như `db.ts` để sống qua hot-reload):
  - Giữ **1 client pg riêng** `pool.connect()` **giữ mở** (KHÔNG dùng `query()` của pool vì pool
    cấp connection khác nhau) chạy `LISTEN order_channel`. Xử lý `error`/`end` → reconnect +
    `LISTEN` lại (backoff đơn giản).
  - Registry `Map<number, Set<(payload) => void>>` keyed by `userId`.
  - `subscribe(userId, cb): () => void` — thêm vào set, trả hàm `unsubscribe`.
  - Khi nhận NOTIFY: parse JSON `{orderId, status, buyerId, restaurantId}` → tập user quan tâm =
    `buyerId` ∪ seller-user-ids của `restaurantId` (query `restaurant_owners`, cache ngắn nếu
    cần) → gọi `cb` cho subscriber khớp.
  - `notifyOrder(q: TxQuery, payload)` — helper `SELECT pg_notify('order_channel', $1)` để repo
    gọi **trong** transaction (NOTIFY chỉ phát khi COMMIT → nguyên tử với state change).
- Sửa `app/src/lib/orders/repo.ts` (task 03): thay placeholder pg_notify bằng `notifyOrder(q, …)`
  trong `createOrder` và `advanceStatus`.

## Done khi
- Test thủ công 2 kết nối psql: phiên A `LISTEN order_channel;`, phiên B `SELECT pg_notify('order_channel','{"x":1}');`
  → A nhận được.
- Gọi `createOrder`/`advanceStatus` phát NOTIFY đúng payload (kiểm bằng client LISTEN).
- Kill kết nối LISTEN (vd restart Postgres) → bus tự reconnect và LISTEN lại, vẫn nhận event sau đó.
- `pnpm lint` xanh; logic LISTEN/fan-out gói gọn trong `bus.ts`.
