# Feature 10 — Đặt món + theo dõi trạng thái realtime

Plan: [`plans/10_orders_realtime.md`](../../plans/10_orders_realtime.md)

Branch đề xuất: `feat/orders-realtime`

## Tóm tắt
Buyer (`role='user'`) đặt món từ 1 quán, chọn **giao hàng** hoặc **lấy tại quầy**, nhập SDT.
Seller (`role='owner'`) nhận đơn và đẩy trạng thái. Cả hai thấy cập nhật **realtime** qua
**SSE + Postgres LISTEN/NOTIFY** (deploy server Node liên tục). **DB là nguồn sự thật**; realtime
chỉ đẩy tín hiệu mỏng → client refetch. Thanh toán tiền mặt khi nhận hàng (không cổng thanh toán).

Luồng trạng thái:
- delivery: `pending → accepted → delivering → arrived → completed`
- pickup:   `pending → accepted → ready → completed`
- huỷ/từ chối: `pending→rejected` (seller) | `(pending|accepted)→cancelled` (buyer)

## Checklist (theo thứ tự phụ thuộc)
- [ ] [01_db_orders.md](01_db_orders.md) — `db/init/11_orders.sql`: orders + order_items + order_events
- [ ] [02_state_machine.md](02_state_machine.md) — `lib/orders/state.ts` (+test) máy trạng thái thuần
- [ ] [03_repo_authz_validate.md](03_repo_authz_validate.md) — repo.ts + authz.ts + orderValidate.ts (+repo.test)
- [ ] [04_api_orders.md](04_api_orders.md) — routes POST/GET orders, GET [id], PATCH status
- [ ] [05_realtime_bus.md](05_realtime_bus.md) — `lib/realtime/bus.ts` LISTEN/NOTIFY + nối pg_notify vào repo
- [ ] [06_api_sse_hook.md](06_api_sse_hook.md) — `api/orders/stream` (SSE) + `lib/useOrderStream.ts`
- [ ] [07_ui_buyer.md](07_ui_buyer.md) — form đặt món + trang theo dõi `/orders/[id]`
- [ ] [08_ui_seller.md](08_ui_seller.md) — dashboard `/seller/orders`
- [ ] [09_finalize.md](09_finalize.md) — lint/test/build + PR

## MUST nhắc lại (AGENTS)
- **SQL chỉ qua `query()`/`withTransaction()`, tham số hoá `$1,$2…`** — never nội suy chuỗi. Schema
  ở `db/init/11_orders.sql` **mới**, additive (không sửa `01_schema.sql`).
- **Validate-at-the-edge** ở mọi route handler trước khi chạm DB (parse body, ép kiểu, chặn range).
- **Giá lấy server-side** từ `menu_items` khi tạo đơn — không tin `price` client gửi.
- **Read-before-write Next 16** (`route.md`) trước khi viết SSE streaming. Route params là `Promise` → `await`.
- **Server-first**; `"use client"` chỉ khi cần. UI dùng **semantic token** (không hex/`zinc`/`gray`),
  chạy được **light + dark**.
- **Integration test chạm Postgres thật** (test DB), không mock. Logic thuần (state machine) unit test.
- Commit: conventional, **không reference AI**. Theo task-commit-link: commit code → thêm dòng
  `> Commit: <hash> — <msg> ✅` vào đầu file task → commit docs-link riêng.
