# 07 — Wiring buyer: đổi nguồn dữ liệu mock → API + realtime

## Vì sao
UI buyer đã có (feature 11/12): `OrderForm`, `OrderTracker`, `OrderStatusTimeline`, `OrderSummary`,
`OrderCard`, trang `/orders` + `/orders/[id]`. Task này chỉ **đổi nguồn dữ liệu** sang API thật +
realtime, **không sửa presentational component**.

## Việc
- **`OrderForm` (đặt món):** thay submit mock (sessionStorage draft) bằng `POST /api/orders` với
  `{restaurantId, fulfillment, items:[{menuItemId,quantity}], phone, address?, lat?, lng?, note?}` →
  nhận `{id}` → điều hướng `/orders/[id]`. Bỏ đường ghi draft.
- **`/orders/[id]/page.tsx` + `OrderTracker`:**
  - page fetch `GET /api/orders/[id]` (server) truyền `Order` xuống `OrderTracker`.
  - `OrderTracker`: **bỏ dev stepper + `simulateAdvance`/`draftToOrder`**; dùng `useOrderStream`
    (task 06) — nhận event của đơn này → refetch `GET /api/orders/[id]`.
  - nút **Huỷ** (`pending`/`accepted`) và **Đã nhận hàng** (`arrived`/`ready`) gọi
    `PATCH /api/orders/[id]/status`; ẩn/hiện theo `canTransition` + `allowedActors` (state.ts).
- **`/orders/page.tsx` (lịch sử):** thay `listMockOrders()` bằng `GET /api/orders` (đơn của buyer);
  vẫn `groupOrders`. Giữ `OrderCard`.

## Done khi
- Đặt được đơn cả 2 kiểu (delivery cần địa chỉ, pickup không) → nhảy sang trang theo dõi đơn thật.
- Trang theo dõi đổi trạng thái **không reload** khi seller advance (qua SSE); reconnect → đúng trạng thái.
- Huỷ / Đã nhận hàng hoạt động đúng theo state machine (nút chỉ hiện khi hợp lệ).
- `/orders` hiển thị đơn thật của buyer; không còn import từ `lib/orders/mock`.
- `pnpm lint` xanh; UI giữ nguyên (light + dark vẫn ổn).
