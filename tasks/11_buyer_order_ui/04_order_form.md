# 04 — Form đặt món + nút "Đặt món" trong RestaurantModal

## Vì sao
Màn hình nhập liệu chính của buyer: chọn món, kiểu nhận hàng, địa chỉ/SDT. Cần tinh chỉnh UX
(stepper số lượng, toggle delivery/pickup, định vị) trước khi nối API.

## Việc
- `app/src/components/OrderForm.tsx` (`"use client"` — có state/effect/geolocation):
  - props `{ restaurantName, menu, onSubmit, onCancel }` (menu lấy từ `RestaurantDetail.menu`
    đã load trong `RestaurantModal`).
  - chọn món + **stepper số lượng** (0..n); tính tổng tiền realtime (format VI).
  - toggle **delivery / pickup**:
    - delivery → ô địa chỉ + nút "Dùng vị trí hiện tại" (`useGeolocation` ở `@/hooks/useGeolocation`)
      + ô SDT.
    - pickup → chỉ ô SDT.
  - ô ghi chú (note) optional.
  - **validate phía UI** trước khi submit: có ≥1 món; SDT hợp lệ; delivery bắt buộc địa chỉ.
    Hiện lỗi inline (validate server vẫn ở plan 10).
  - submit → gọi `onSubmit(payload)` (mock); disable nút khi không hợp lệ.
- Sửa `app/src/components/RestaurantModal.tsx`:
  - thêm nút **"Đặt món"** (token `bg-brand text-brand-foreground`) trong khối hành động.
  - bấm → mở `OrderForm` (section trong aside hoặc sheet), truyền `detail.menu` + `detail.restaurant.name`.
  - `onSubmit` (tạm, mock): tạo order mock + điều hướng `/orders/[id]` (dùng `useRouter`).
  - giữ nguyên phần còn lại của modal; component cũ vẫn dùng palette cũ (không bắt buộc migrate).

## Done khi
- Mở quán → bấm "Đặt món" → form hiện menu quán, chọn món thấy tổng tiền đổi.
- Toggle delivery/pickup đổi đúng field; "Dùng vị trí hiện tại" điền toạ độ; validate chặn submit
  khi thiếu món/SDT/địa chỉ (delivery).
- Submit (mock) điều hướng sang `/orders/[id]`.
- Chạy light + dark; `pnpm lint` xanh.
