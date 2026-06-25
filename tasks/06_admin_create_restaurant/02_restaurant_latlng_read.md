# 02 — Đọc lat/lng cho form edit

## Vì sao
Form edit dùng chung cần hiển thị toạ độ hiện có của quán → `getRestaurantForEdit` phải trả
về lat/lng.

## Việc
- `app/src/lib/adminRestaurant.ts`:
  - Type `RestaurantForEdit`: thêm `lat: number | null; lng: number | null;`.
  - SELECT quán: thêm `lat, lng`.
  - Map kết quả: `lat: r.lat != null ? Number(r.lat) : null` (tương tự lng).

## Done khi
- `RestaurantForEdit` có lat/lng; build TS không lỗi.
- `getRestaurantForEdit` trả lat/lng đúng cho quán đã có toạ độ.

## Commit
https://github.com/dang1412/platelyai/commit/2cf9305
