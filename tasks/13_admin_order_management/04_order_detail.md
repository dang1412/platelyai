# 04 — Trang chi tiết /admin/orders/[id] + thao tác

## Vì sao
Seller cần xem đầy đủ 1 đơn và thực hiện thao tác (nhận/từ chối/đẩy trạng thái) — mô phỏng bằng mock.

## Việc
- `app/src/components/admin/SellerActionPanel.tsx` (`"use client"`):
  - Nhận `initialOrder: Order`; giữ `order` ở `useState`.
  - Render nút theo logic task 01: nếu `canReject(order)` → nút **Từ chối** (gọi `simulateReject`);
    nếu `nextSellerStep(order)` ≠ null → nút nhãn `step.label` (gọi `simulateAdvance`); terminal →
    hiện trạng thái cuối, không nút.
  - Cập nhật local state sau thao tác (chưa có backend). Semantic token (nút brand/success/muted).
- `app/src/app/admin/orders/[id]/page.tsx` (**server component**):
  - `await params`; validate `id` (chuỗi không rỗng); `getMockOrder(id)`; `notFound()` nếu null.
  - Render `OrderStatusBadge` + `OrderSummary` + `OrderStatusTimeline` (tái dùng, đã có) +
    `<SellerActionPanel initialOrder={order} />`. Bố cục `max-w-lg`/`max-w-3xl` bám hàng xóm.
  - Link "← Về danh sách" `/admin/orders`.

## Done khi
- Mở `/admin/orders/<id>` thấy chi tiết đơn + timeline + nút thao tác đúng theo trạng thái.
- Bấm Nhận/Đẩy/Từ chối → timeline + badge cập nhật tại chỗ (mock).
- id sai → `notFound()`. Light + dark ổn.
