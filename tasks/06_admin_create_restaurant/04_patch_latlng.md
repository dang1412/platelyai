# 04 — PATCH :id nhận thêm lat/lng

## Vì sao
Form edit dùng chung gửi lat/lng → route PATCH phải cập nhật được toạ độ (additive, không phá
hành vi cũ).

## Việc
- `app/src/app/api/admin/restaurants/[id]/route.ts`:
  - Validate thêm `{ lat, lng } = optionalLatLng(body.lat, body.lng)`.
  - `UPDATE restaurants` set thêm `lat = $.., lng = $.., location = CASE WHEN … ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography END`.
  - **Quy ước:** chỉ ghi toạ độ khi cả hai có mặt; nếu body không gửi (cả hai null) → vẫn set
    lat/lng/location = NULL theo giá trị optionalLatLng. **Lưu ý:** vì form edit luôn gửi lat/lng
    hiện có, không mất dữ liệu. (Xoá toạ độ có chủ đích = ngoài scope.)
  - Giữ tham số hoá `$1..$n`; cập nhật đúng số thứ tự param sau khi chèn lat/lng.

## Done khi
- PATCH có lat/lng → cập nhật location đúng; PATCH như cũ (form gửi lại toạ độ cũ) không đổi dữ liệu.
- Validate/authz vẫn nguyên; lint/build xanh.

## Commit
https://github.com/dang1412/platelyai/commit/d42d038
