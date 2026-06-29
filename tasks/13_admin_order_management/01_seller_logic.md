# 01 — Logic phía seller (thuần + test)

> Commit: 0165238 — feat(orders): logic seller — groupSellerOrders + nextSellerStep + canReject (+ test) ✅

## Vì sao
Nhóm đơn 3 cụm + xác định bước "đẩy tới" + có được từ chối không — là **logic thuần**, phải tách
khỏi UI để test độc lập (AGENTS §6).

## Việc
- `app/src/lib/orders/sellerActions.ts`:
  - `groupSellerOrders(orders): { needsAction: Order[]; inProgress: Order[]; done: Order[] }` —
    `needsAction` = `pending`; `done` = `completed/rejected/cancelled`; còn lại `inProgress`. Mỗi cụm
    sort `createdAt` **desc**. Không mutate input.
  - `nextSellerStep(order): { toStatus: OrderStatus; label: string } | null` — bước kế tiếp theo
    `flowFor(order.fulfillment)`; nhãn VI hành động (pending→accepted "Nhận đơn"; delivery
    accepted→delivering "Bắt đầu giao"; delivering→arrived "Đã tới nơi"; arrived→completed "Hoàn tất";
    pickup accepted→ready "Sẵn sàng lấy"; ready→completed "Hoàn tất"). Terminal/không có bước → `null`.
  - `canReject(order): boolean` — `true` chỉ khi `status === 'pending'`.
- `app/src/lib/orders/sellerActions.test.ts`:
  - `groupSellerOrders`: chia đúng cụm, sort desc, mảng rỗng, không mutate.
  - `nextSellerStep`: kiểm mọi status cho cả delivery + pickup; terminal → null.
  - `canReject`: true cho pending, false cho phần còn lại.

## Done khi
- `pnpm test` xanh, có case cho cả 3 helper.
- File thuần, không import React/DB; tái dùng `flowFor`/`isActiveStatus` thay vì chép hằng số.
