# 03 — Repo: get/upsert profile

## Vì sao

Tách lớp dữ liệu (SQL tham số hoá) khỏi route. Theo mẫu `src/lib/orders/repo.ts`.

## Việc

- Tạo `app/src/lib/profile/repo.ts`:
  - `export type BuyerProfile = { phone: string | null; address: string | null; lat: number | null; lng: number | null }`.
  - `getBuyerProfile(userId: number): Promise<BuyerProfile>`:
    `SELECT default_phone, default_address, default_lat, default_lng FROM users WHERE id=$1`,
    map về `BuyerProfile` (null khi cột NULL). Không có row → trả toàn null.
  - `upsertBuyerProfile(userId: number, input: BuyerProfileInput): Promise<void>`:
    `UPDATE users SET default_phone=$2, default_address=$3, default_lat=$4, default_lng=$5 WHERE id=$1`.
    (Row user chắc chắn tồn tại — đã đăng nhập.)
  - Dùng `query()` từ `@/lib/db`, **tham số hoá $1..$5** (MUST). Không tạo Pool mới.
  - Lưu ý kiểu: `default_lat/lng` từ pg có thể về string → ép `Number(...)` khi map (xem cách
    `orders/repo.ts` xử lý số).

## Done khi

- Hai hàm export đúng chữ ký, SQL tham số hoá.
- (Tuỳ chọn) `profile/repo.test.ts` integration chạm Postgres thật: upsert → get trả đúng; ghi đè.
