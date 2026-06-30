# 02 — Validate input profile

## Vì sao

Validate-at-the-edge (MUST): ép kiểu + chặn giá trị xấu TRƯỚC khi route chạm DB. Tách riêng logic
thuần để unit test không cần DB.

## Việc

- Tạo `app/src/lib/profileValidate.ts`:
  - `export type BuyerProfileInput = { phone: string | null; address: string | null; lat: number | null; lng: number | null }`.
  - `export function parseBuyerProfile(body: unknown): BuyerProfileInput`:
    - body không phải object → `ValidationError("Body không hợp lệ")`.
    - `phone`: optional; nếu có (sau trim khác rỗng) phải khớp `/^0\d{9}$/`, sai → ValidationError.
      Trống → `null`.
    - `address`: `optionalText(b.address)`.
    - `lat/lng`: `optionalLatLng(b.lat, b.lng)`. Nếu có lat/lng nhưng `address` null → ValidationError
      ("Có toạ độ thì cần địa chỉ") — toạ độ không đứng một mình.
  - Tái dùng `ValidationError`, `optionalText`, `optionalLatLng` từ `./adminValidate`.
- Tạo `app/src/lib/profileValidate.test.ts` (Vitest, cạnh nguồn):
  - body rỗng `{}` → tất cả null, không throw.
  - phone hợp lệ / sai định dạng / chuỗi rỗng (→ null).
  - address + lat/lng đủ cặp OK; lat/lng thiếu cặp → throw; lat/lng có nhưng address null → throw.

## Done khi

- `parseBuyerProfile` xử lý đúng các case trên.
- `pnpm test` (từ `app/`) cho file này xanh.
