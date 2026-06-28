# 11 — Giao diện phía người đặt món (UI-first, mock data)

## Mục tiêu
Dựng **trước** toàn bộ giao diện buyer cho luồng đặt món (form đặt + trang theo dõi trạng thái)
bằng **mock data**, tách component presentational khỏi nguồn dữ liệu, để **tinh chỉnh UI/UX**
trước khi nối backend thật (plan [`10_orders_realtime`](10_orders_realtime.md)).

Màn hình/route:
- `/orders/[id]` — trang theo dõi đơn (timeline trạng thái + tóm tắt đơn).
- Form đặt món — mở từ nút **"Đặt món"** trong `RestaurantModal` (tái dùng menu đã load).
- (nhẹ, tuỳ chọn) `/orders` — danh sách đơn của tôi.

## Quyết định mặc định (chỉnh được)
- **Mock-only, không backend/DB/AI.** Component nhận **props có kiểu**; 1 lớp mock (`lib/orders/mock.ts`)
  cấp dữ liệu + giả lập chuyển trạng thái cục bộ để preview mọi state. Nối API thật là việc của plan 10
  (chỉ thay nguồn dữ liệu, **không sửa** presentational component).
- **Thêm lớp semantic token** vào `globals.css` rồi dùng token cho màn hình mới — thay vì chép
  `bg-zinc-*`/`bg-orange-*` như component cũ (tuân §5 + agent rule #4; cũng giúp tinh chỉnh nhanh).
  Component cũ giữ nguyên palette literal (migrate sau, ngoài scope).
- **Vào form từ `RestaurantModal`** (không tạo route full-page riêng cho đặt món ở bước này).
- Luồng/trạng thái bám plan 10: delivery `pending→accepted→delivering→arrived→completed`;
  pickup `pending→accepted→ready→completed`; `cancelled`/`rejected`.

## Luồng (toàn bộ client, dữ liệu mock — KHÔNG chạm DB/AI)

```
RestaurantModal ──[Đặt món]──► OrderForm (sheet)
   chọn món+SL · delivery/pickup · địa chỉ(useGeolocation)/SDT · note · tổng tiền
        │ submit (mock) → tạo order mock → điều hướng /orders/[id]
        ▼
/orders/[id]  ── OrderStatusTimeline + tóm tắt đơn + nút Huỷ/Đã nhận
   (dev stepper: giả lập seller đẩy trạng thái để xem mọi state)
```

## Backend (chỉ lib thuần, KHÔNG route/DB)
- `app/src/lib/orders/types.ts` — kiểu dùng chung (sẽ tái dùng cho plan 10): `Fulfillment`,
  `OrderStatus`, `OrderItem`, `OrderEvent`, `Order` (đủ field để render: items, total, phone,
  địa chỉ/toạ độ, fulfillment, status, events, createdAt).
- `app/src/lib/orders/statusMeta.ts` (+ `statusMeta.test.ts`) — **presentational metadata thuần**:
  nhãn tiếng Việt + icon cho mỗi status; thứ tự bước theo `fulfillment`; helper
  `timelineSteps(fulfillment, status)` → view-model `{key,label,state:'done'|'current'|'todo'}`.
  Pure → unit test (§6), không trùng logic transition của plan 10 (đó là `state.ts`).
- `app/src/lib/orders/mock.ts` — fixtures vài đơn mẫu (mỗi trạng thái 1 cái) + `simulateAdvance(order)`
  trả order kế tiếp theo fulfillment, để dev stepper/preview chạy cục bộ. **Đánh dấu tạm**, plan 10 thay.

## Frontend (`src/components/…`; semantic token; light + dark; `"use client"` khi cần)
- `OrderStatusBadge.tsx` — pill trạng thái (màu theo token: brand/success/muted).
- `OrderStatusTimeline.tsx` — render `timelineSteps(...)`, highlight bước hiện tại, phân nhánh
  delivery/pickup.
- `OrderSummary.tsx` — danh sách món + số lượng + tổng tiền (định dạng `toLocaleString('vi-VN')`,
  tái dùng cách format giá trong `RestaurantModal`).
- `OrderForm.tsx` (`"use client"`) — chọn món + stepper số lượng (từ menu quán), toggle
  **delivery/pickup**, delivery → địa chỉ + định vị (`useGeolocation` sẵn có) + SDT, pickup → SDT;
  note; hiện tổng tiền; submit gọi prop `onSubmit` (mock). Validate **phía UI** (SDT, có món,
  delivery cần địa chỉ) — validate server vẫn làm ở plan 10.
- `OrderCard.tsx` — tóm tắt 1 đơn cho danh sách (dùng lại badge + summary rút gọn).
- Tích hợp nút **"Đặt món"** vào `RestaurantModal.tsx` → mở `OrderForm` (sheet/section).
- Trang `app/src/app/orders/[id]/page.tsx` — lấy order từ mock theo `id`, render timeline + summary
  + nút **Huỷ** (khi pending/accepted) / **Đã nhận hàng** (khi arrived/ready); kèm **dev stepper**
  ẩn để duyệt mọi trạng thái (tạm thời, gỡ/khoá khi nối plan 10).
- (tuỳ chọn) `app/src/app/orders/page.tsx` — list `OrderCard` từ mock.

## Schema
**Không có.** Plan này không đụng DB (mock-only).

## Bảng file đụng tới
| File | Loại |
| --- | --- |
| `app/src/app/globals.css` | sửa (thêm `@theme` token: surface/border/muted-foreground/brand/success…) |
| `app/src/lib/orders/types.ts` | mới (kiểu dùng chung) |
| `app/src/lib/orders/statusMeta.ts` (+`.test.ts`) | mới (logic thuần presentational) |
| `app/src/lib/orders/mock.ts` | mới (fixtures + simulateAdvance, tạm) |
| `app/src/components/{OrderStatusBadge,OrderStatusTimeline,OrderSummary,OrderForm,OrderCard}.tsx` | mới |
| `app/src/app/orders/[id]/page.tsx` (+ tuỳ chọn `orders/page.tsx`) | mới |
| `app/src/components/RestaurantModal.tsx` | sửa (nút "Đặt món" → OrderForm) |

## Test & guardrails
- **Unit (không DB):** `statusMeta.test.ts` — `timelineSteps` đúng số bước/trạng thái cho cả
  delivery & pickup; bước `current` đúng vị trí; trạng thái terminal (completed/cancelled/rejected)
  render hợp lý.
- **Thủ công:** chạy `pnpm dev`, mở `/orders/[id]` với từng mock; dùng dev stepper xem mọi state;
  kiểm light + dark; mở form từ `RestaurantModal`, đặt thử (mock) → điều hướng sang tracking.
- **Trước PR:** `pnpm lint && pnpm test && pnpm build` xanh (từ `app/`).
- **MUST:** semantic token (không `bg-zinc-*`/hex mới ở màn hình mới); server-first, `"use client"`
  chỉ khi cần; spacing/typography theo scale Tailwind; chạy light + dark.

## Mở rộng ngoài scope
- Nối API thật + SSE realtime (plan 10 task 04/06/07); migrate component cũ sang semantic token;
  giỏ hàng đa-quán; thanh toán online; lịch sử đơn đầy đủ + lọc.
