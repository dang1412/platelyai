# 01 — DB: schema đơn hàng

## Vì sao
Chưa có khái niệm đơn hàng trong DB. Cần 3 bảng: `orders` (đơn + trạng thái + thông tin
giao/lấy), `order_items` (món đã đặt, **snapshot** tên+giá tại lúc đặt để đơn không đổi khi
menu sửa giá), `order_events` (append-only: vừa là audit log vừa là feed cho realtime).

## Việc
- Tạo file mới `db/init/11_orders.sql` (KHÔNG sửa `01_schema.sql` đã apply — §4 additive).
- Quy ước: `BIGSERIAL` id, `snake_case`, **`TIMESTAMPTZ`** cho mốc thời gian (state-change là
  time-critical), `ON DELETE CASCADE` cho bảng con.
- `orders`:
  - `buyer_id BIGINT NOT NULL REFERENCES users(id)`, `restaurant_id BIGINT NOT NULL REFERENCES restaurants(id)`.
  - `fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN ('delivery','pickup'))`.
  - `status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','delivering',
    'arrived','ready','completed','rejected','cancelled'))`.
  - `buyer_phone TEXT NOT NULL`; `delivery_address TEXT`, `delivery_lat/lng DOUBLE PRECISION`,
    `delivery_location GEOGRAPHY(POINT,4326)` (NULL khi pickup); `note TEXT`;
    `total_amount INTEGER NOT NULL DEFAULT 0`; `created_at/updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- `order_items`: `order_id` (CASCADE), `menu_item_id BIGINT REFERENCES menu_items(id) ON DELETE SET NULL`
  (giữ đơn dù món bị xoá), `name_snapshot TEXT NOT NULL`, `price_snapshot INTEGER NOT NULL`,
  `quantity INTEGER NOT NULL CHECK (quantity > 0)`.
- `order_events`: `order_id` (CASCADE), `status TEXT NOT NULL`, `actor_id BIGINT REFERENCES users(id)`,
  `note TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- Index: `orders(buyer_id)`; `orders(restaurant_id, status)`; `order_events(order_id, created_at)`.
- Dùng `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` cho idempotent.

## Done khi
- Chạy `11_orders.sql` trên DB dev không lỗi; chạy lại lần 2 cũng không lỗi (idempotent).
- `\d orders` cho thấy đúng cột + CHECK constraint; FK tới users/restaurants/menu_items đúng.
- INSERT thử 1 đơn `pending` + 1 item + 1 event chạy được; INSERT `quantity = 0` bị CHECK chặn;
  `status`/`fulfillment_type` ngoài enum bị chặn.
