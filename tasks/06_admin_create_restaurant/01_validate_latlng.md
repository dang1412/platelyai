# 01 — Validate lat/lng

## Vì sao
Cả `POST` (tạo) và `PATCH` (sửa) đều cần validate toạ độ giống nhau. Tách ra helper thuần
để test không cần DB và tái dùng ở cả hai route.

## Việc
- `app/src/lib/adminValidate.ts`: thêm `optionalLatLng(lat: unknown, lng: unknown)`.
  - Cả hai `null/undefined/""` → trả `{ lat: null, lng: null }`.
  - Chỉ một trong hai có mặt → `ValidationError("Cần cả lat và lng")`.
  - Không phải số → `ValidationError`.
  - `lat ∉ [-90, 90]` hoặc `lng ∉ [-180, 180]` → `ValidationError`.
  - Hợp lệ → `{ lat: number, lng: number }`.
- `app/src/lib/adminValidate.test.ts` (file mới): unit test các case trên (Vitest).

## Done khi
- `optionalLatLng` export, dùng `ValidationError` sẵn có (không class mới).
- `pnpm test` chạy file mới xanh, phủ: cả null, hợp lệ, thiếu một, ngoài range, NaN.

## Commit
https://github.com/dang1412/platelyai/commit/25e4227
