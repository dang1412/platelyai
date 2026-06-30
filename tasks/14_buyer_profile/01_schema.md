# 01 — Schema: thông tin mặc định của buyer

## Vì sao

Cần chỗ lưu SĐT + địa chỉ + toạ độ mặc định cho mỗi buyer. 1 buyer = 1 bộ → thêm cột vào `users`
(KISS), không tạo bảng riêng. Phải additive (AGENTS §4) — file mới đánh số kế tiếp.

## Việc

- Tạo `db/init/12_buyer_profile.sql`:
  - Ghi chú đầu file theo mẫu `11_orders.sql` (tự chạy khi volume trống; volume có data chạy tay
    bằng `psql "$DATABASE_URL" -f db/init/12_buyer_profile.sql`).
  - `ALTER TABLE users ADD COLUMN IF NOT EXISTS default_phone   TEXT;`
  - `... ADD COLUMN IF NOT EXISTS default_address TEXT;`
  - `... ADD COLUMN IF NOT EXISTS default_lat     DOUBLE PRECISION;`
  - `... ADD COLUMN IF NOT EXISTS default_lng     DOUBLE PRECISION;`
  - Không index (đọc theo PK `id`).
- Áp lên DB dev đang chạy (volume đã có data) bằng lệnh psql ở trên.

## Done khi

- File SQL tồn tại, additive, không sửa file `db/init/*` cũ.
- 4 cột đã có trên bảng `users` của DB dev (verify: `\d users`).
