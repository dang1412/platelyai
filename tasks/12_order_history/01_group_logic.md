# 01 — Logic phân nhóm đơn (thuần + test)

> Commit: ff27e9c — feat(orders): phân nhóm đơn active/history (isActiveStatus + groupOrders + test) ✅

## Vì sao
Trang lịch sử tách "Đang xử lý" vs "Lịch sử". Việc phân nhóm + sắp xếp là **logic thuần**, phải
tách khỏi component để test độc lập (AGENTS §6, rule #6).

## Việc
- `app/src/lib/orders/statusMeta.ts`:
  - Thêm `isActiveStatus(status: OrderStatus): boolean` — `true` cho nhóm đang xử lý
    (`pending, accepted, delivering, arrived, ready`); `false` cho `completed/cancelled/rejected`.
    Tái dùng định nghĩa terminal sẵn có (đừng chép hằng số rời rạc — có thể derive từ `statusTone`
    hoặc một set terminal dùng chung).
  - Thêm `groupOrders(orders: Order[]): { active: Order[]; history: Order[] }` — chia theo
    `isActiveStatus`, mỗi nhóm sort `createdAt` **desc** (mới nhất trước). Không mutate input.
- `app/src/lib/orders/statusMeta.test.ts`:
  - `isActiveStatus`: assert đúng cho cả 8 status.
  - `groupOrders`: chia đúng nhóm; thứ tự desc theo `createdAt`; input rỗng → `{active:[],history:[]}`;
    không sửa mảng gốc.

## Done khi
- `pnpm test` xanh, có case mới cho cả 2 helper.
- `isActiveStatus`/`groupOrders` export, không import React/DB.
