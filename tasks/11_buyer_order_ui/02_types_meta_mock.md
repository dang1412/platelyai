# 02 — Kiểu dùng chung + metadata trạng thái + mock

> Commit: `a879e3b` — feat(orders): semantic token + types/statusMeta/mock cho UI buyer ✅

## Vì sao
Component presentational cần **kiểu rõ ràng** và **metadata trạng thái** (nhãn VI, thứ tự bước)
để render; trang cần **mock data** để chạy độc lập không backend. Tách `statusMeta` thuần ra để
unit test và để timeline khỏi hardcode bước.

## Việc
- `app/src/lib/orders/types.ts` (sẽ tái dùng cho plan 10 — đặt kiểu đủ tổng quát):
  - `Fulfillment = 'delivery' | 'pickup'`.
  - `OrderStatus = 'pending'|'accepted'|'delivering'|'arrived'|'ready'|'completed'|'rejected'|'cancelled'`.
  - `OrderItem { name; price; quantity }` (mock dùng tên+giá; menuItemId thêm sau ở plan 10).
  - `OrderEvent { status; at: string; note?: string }`.
  - `Order { id; restaurantName; fulfillment; status; items; total; phone; address?; note?;
    events: OrderEvent[]; createdAt: string }`.
- `app/src/lib/orders/statusMeta.ts` (thuần, không import react/db):
  - `STATUS_LABEL: Record<OrderStatus, string>` (vd `pending: 'Chờ xác nhận'`, `accepted: 'Đang chuẩn bị'`,
    `delivering: 'Đang giao'`, `arrived: 'Đã tới'`, `ready: 'Sẵn sàng lấy'`, `completed: 'Hoàn tất'`,
    `cancelled: 'Đã huỷ'`, `rejected: 'Bị từ chối'`).
  - thứ tự bước theo fulfillment (delivery vs pickup).
  - `timelineSteps(fulfillment, status): { key: OrderStatus; label: string; state: 'done'|'current'|'todo' }[]`
    — bước trước status = done, đúng status = current, sau = todo; xử lý `cancelled`/`rejected`
    (hiển thị nhánh kết thúc, không vẽ các bước sau).
- `app/src/lib/orders/statusMeta.test.ts` — phủ delivery & pickup: đúng số bước, vị trí `current`,
  và case terminal.
- `app/src/lib/orders/mock.ts` (**tạm**, plan 10 thay):
  - vài `Order` mẫu (mỗi trạng thái ~1 cái), `getMockOrder(id)`, `listMockOrders()`.
  - `simulateAdvance(order): Order` — trả order ở trạng thái kế tiếp theo fulfillment (đẩy
    `events` thêm 1 dòng) để dev stepper preview.

## Done khi
- `pnpm test` xanh gồm `statusMeta.test.ts` (không cần DB).
- `statusMeta.ts` không import React/DB; `mock.ts` cô lập, dễ xoá khi nối plan 10.
