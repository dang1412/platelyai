# 08 — UI seller: dashboard đơn hàng

## Vì sao
Seller (`role='owner'`) cần thấy đơn mới đến realtime và đẩy trạng thái qua các bước.

## Việc
- `app/src/app/seller/orders/page.tsx` (`"use client"` phần cần stream):
  - fetch `GET /api/orders` (server trả đơn của các quán user sở hữu — `listActiveOrdersForSeller`).
  - dùng `useOrderStream` (task 06): nhận event → refetch danh sách (đơn `pending` mới hiện ngay,
    có thể kèm chuông/badge đếm).
  - mỗi đơn dùng `OrderCard` + nút **advance** theo state machine (`nextStatusesFor`):
    - `pending` → **Chấp nhận** / **Từ chối**
    - `accepted` → **Bắt đầu giao** (delivery) / **Sẵn sàng lấy** (pickup)
    - `delivering` → **Đã tới**
    - nút gọi `PATCH /api/orders/[id]/status`.
  - phân nhóm: đơn đang hoạt động vs đã xong (completed/rejected/cancelled).
- Bảo vệ trang: chỉ `role` `owner`/`admin` vào được (redirect/empty nếu `user`).
- UI: **semantic token**, light + dark; bám style trang `/admin` hiện có.

## Done khi
- Seller mở dashboard thấy đơn của quán mình; đơn buyer vừa đặt **hiện ra không reload**.
- Bấm advance đổi trạng thái và buyer thấy ngay (kiểm cùng task 09 verify 2 cửa sổ).
- Nút chỉ hiện trạng thái hợp lệ kế tiếp theo fulfillment; user thường không vào được.
- `pnpm lint` xanh; chạy light + dark.
