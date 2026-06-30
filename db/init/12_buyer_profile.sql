-- Plately — thông tin mặc định của buyer (xem plan 14).
--
-- 1 buyer = 1 bộ thông tin giao hàng mặc định → thêm cột thẳng vào `users` (KISS), không tạo
-- bảng riêng. Dùng để prefill form đặt món; đơn vẫn snapshot phone/address tại lúc đặt (không
-- đụng bảng orders).
--
-- Additive (§4): KHÔNG sửa các file db/init/*.sql đã apply. File này tự chạy khi volume Postgres
-- còn TRỐNG. Với volume đã có dữ liệu, chạy tay:
--   set -a; . ./.env; set +a
--   psql "$DATABASE_URL" -f db/init/12_buyer_profile.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS default_phone   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_lat     DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_lng     DOUBLE PRECISION;
