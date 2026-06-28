# 07 — UI buyer: form đặt món + trang theo dõi

## Vì sao
Buyer cần đặt món (chọn giao hàng/lấy tại quầy, SDT) và theo dõi trạng thái realtime.

## Việc
- Component dùng chung (server-first, `"use client"` chỉ khi cần; **semantic token**, light+dark, §5):
  - `app/src/components/OrderStatusTimeline.tsx` — render chuỗi `order_events` theo fulfillment
    (delivery vs pickup hiện bước khác nhau), highlight bước hiện tại.
  - `app/src/components/OrderCard.tsx` — tóm tắt 1 đơn (món, tổng tiền, trạng thái) dùng lại cho seller.
- **Form đặt món** (`"use client"`): nút "Đặt món" trên `RestaurantModal`/trang quán → mở form:
  - chọn món + số lượng (từ menu quán), chọn `fulfillment_type` (delivery/pickup).
  - delivery → nhập/định vị địa chỉ (tái dùng hook `useGeolocation` sẵn có) + SDT; pickup → chỉ SDT.
  - submit → `POST /api/orders` → điều hướng `/orders/[id]`.
- **Trang theo dõi** `app/src/app/orders/[id]/page.tsx`:
  - fetch `GET /api/orders/[id]`; dùng `useOrderStream` (task 06): khi nhận event của đơn này → refetch.
  - hiện `OrderStatusTimeline` + thông tin đơn; badge nổi bật khi `arrived` ("Shipper đã tới — ra
    nhận hàng") hoặc `ready` ("Món đã sẵn sàng — tới quầy lấy"); nút **Huỷ** khi `pending`/`accepted`
    (PATCH `cancelled`); khi `arrived`/`ready` → nút **Đã nhận hàng** (PATCH `completed`).

## Done khi
- Đặt được đơn cả 2 kiểu (delivery cần địa chỉ, pickup không) → nhảy sang trang theo dõi.
- Trang theo dõi đổi trạng thái **không reload** khi seller advance (qua SSE).
- Huỷ / Đã nhận hàng hoạt động đúng theo state machine (nút chỉ hiện khi hợp lệ).
- Chạy được light + dark; không dùng hex/`zinc`/`gray` literal.
