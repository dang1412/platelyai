# 05 — Trang theo dõi đơn /orders/[id] (+ tuỳ chọn danh sách)

> Commit: `b804f3b` — feat(orders): trang theo dõi /orders/[id] + danh sách /orders (mock + dev stepper) ✅
> Khung `page.tsx` server-first (await params + getMockOrder); tương tác ở client `OrderTracker`
> (Huỷ/Đã nhận hàng/dev stepper, fallback đọc draft sessionStorage từ task 04). Đã làm cả `/orders`.

## Vì sao
Màn hình buyer xem trạng thái đơn. Cần preview **mọi trạng thái** để tinh chỉnh timeline/nút —
dùng dev stepper giả lập seller đẩy trạng thái (vì chưa có backend/SSE).

## Việc
- `app/src/app/orders/[id]/page.tsx`:
  - `await params` (Next 16 — params là Promise), lấy order từ `getMockOrder(id)`.
  - render `OrderStatusTimeline` + `OrderSummary` + `OrderStatusBadge`.
  - badge nổi bật khi `arrived` ("Shipper đã tới — ra nhận hàng") / `ready` ("Món đã sẵn sàng —
    tới quầy lấy").
  - nút **Huỷ** (hiện khi `pending`/`accepted`) → set status `cancelled` (mock, local state);
    nút **Đã nhận hàng** (hiện khi `arrived`/`ready`) → `completed`.
  - **dev stepper** (client island, ẩn/đánh dấu "preview"): nút "→ trạng thái kế" gọi
    `simulateAdvance` để duyệt mọi state. Ghi chú TODO gỡ/khoá khi nối plan 10.
  - phần tương tác (nút/stepper) tách thành client component nhỏ; phần khung có thể server-first.
- (tuỳ chọn) `app/src/app/orders/page.tsx` — list `OrderCard` từ `listMockOrders()`, click → `/orders/[id]`.

## Done khi
- `/orders/<id>` render đúng với mock; dev stepper duyệt được hết các trạng thái delivery & pickup.
- Nút Huỷ / Đã nhận hàng hiện đúng theo trạng thái; bấm đổi UI (mock).
- Chạy light + dark; `pnpm lint` + `pnpm build` xanh (route mới build được).
