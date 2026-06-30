-- Plately — đơn hàng + realtime (xem plan 10).
--
-- 3 bảng: orders (đơn + trạng thái + thông tin giao/lấy), order_items (món đã đặt — snapshot
-- tên+giá tại lúc đặt để đơn không đổi khi menu sửa giá), order_events (append-only: vừa là
-- audit log vừa là feed cho realtime qua LISTEN/NOTIFY).
--
-- Additive (§4): KHÔNG sửa các file db/init/*.sql đã apply. File này tự chạy khi volume Postgres
-- còn TRỐNG. Với volume đã có dữ liệu, chạy tay:
--   set -a; . ./.env; set +a
--   psql "$DATABASE_URL" -f db/init/11_orders.sql

CREATE TABLE IF NOT EXISTS orders (
  id                BIGSERIAL PRIMARY KEY,
  buyer_id          BIGINT NOT NULL REFERENCES users(id),
  restaurant_id     BIGINT NOT NULL REFERENCES restaurants(id),
  fulfillment_type  TEXT NOT NULL CHECK (fulfillment_type IN ('delivery', 'pickup')),
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'delivering', 'arrived', 'ready',
                      'completed', 'rejected', 'cancelled')),
  buyer_phone       TEXT NOT NULL,
  delivery_address  TEXT,                          -- NULL khi pickup
  delivery_lat      DOUBLE PRECISION,
  delivery_lng      DOUBLE PRECISION,
  delivery_location GEOGRAPHY(POINT, 4326),
  note              TEXT,
  total_amount      INTEGER NOT NULL DEFAULT 0,    -- VND, snapshot tổng tại lúc đặt
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id             BIGSERIAL PRIMARY KEY,
  order_id       BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id   BIGINT REFERENCES menu_items(id) ON DELETE SET NULL,  -- giữ đơn dù món bị xoá
  name_snapshot  TEXT NOT NULL,
  price_snapshot INTEGER NOT NULL,
  quantity       INTEGER NOT NULL CHECK (quantity > 0)
);

-- Append-only: mỗi lần đổi trạng thái thêm 1 dòng (audit + feed realtime).
CREATE TABLE IF NOT EXISTS order_events (
  id         BIGSERIAL PRIMARY KEY,
  order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  actor_id   BIGINT REFERENCES users(id),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: liệt kê đơn của buyer; dashboard seller lọc theo quán + trạng thái; dựng timeline đơn.
CREATE INDEX IF NOT EXISTS orders_buyer_idx
  ON orders (buyer_id);
CREATE INDEX IF NOT EXISTS orders_restaurant_status_idx
  ON orders (restaurant_id, status);
CREATE INDEX IF NOT EXISTS order_events_order_idx
  ON order_events (order_id, created_at);
