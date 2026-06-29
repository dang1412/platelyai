# 08 — Wiring seller: `/admin/orders` dùng API + realtime; gỡ mock

## Vì sao
UI seller đã có (feature 13): `/admin/orders` (nhóm trạng thái + lọc quán), `/admin/orders/[id]`,
`SellerOrderRow`, `SellerActionPanel`, badge số đơn pending ở side menu. Task này **đổi nguồn dữ liệu**
sang API thật + realtime và **xoá `lib/orders/mock.ts`**.

## Việc
- **`/admin/orders/page.tsx`:** thay `listMockOrders()` bằng `GET /api/seller/orders` (đơn của quán
  seller `canEdit`); dropdown lọc lấy danh sách quán seller sở hữu (thay `restaurantNames(mock)`).
  Vẫn `groupSellerOrders`. Dùng `useOrderStream` để refetch khi có đơn mới/đổi trạng thái.
- **`/admin/orders/[id]/page.tsx` + `SellerActionPanel`:** page fetch `GET /api/orders/[id]`; panel
  thay `simulateAdvance`/`simulateReject` bằng `PATCH /api/orders/[id]/status` (nút theo
  `nextSellerStep`/`canReject` — bám `state.ts`). `useOrderStream` để đồng bộ realtime.
- **Badge side menu (`AuthButton`):** thay đếm `groupSellerOrders(listMockOrders())` bằng số thật từ
  `GET /api/seller/orders?status=pending` (count); cập nhật khi có event (nhẹ — fetch lại khi mở menu
  hoặc qua stream nếu sẵn).
- **Gỡ mock:** xoá `app/src/lib/orders/mock.ts`; bảo đảm **không còn import** `mock` ở bất kỳ đâu
  (`grep`); `simulateAdvance`/`simulateReject`/`listMockOrders`/`getMockOrder`/`restaurantNames` biến mất.

## Done khi
- Seller mở `/admin/orders` thấy đơn thật của quán mình; đơn buyer vừa đặt **hiện ra không reload**.
- Bấm Nhận/Từ chối/đẩy trạng thái → buyer thấy ngay; lọc theo quán đúng.
- Badge side menu hiển thị số đơn pending thật.
- `grep -r "orders/mock"` không còn kết quả; `pnpm lint` xanh; UI giữ nguyên (light + dark).
