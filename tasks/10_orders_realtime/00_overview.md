# Feature 10 — Đặt món + theo dõi trạng thái realtime (backend cho UI đã có)

Plan: [`plans/10_orders_realtime.md`](../../plans/10_orders_realtime.md)

Branch đề xuất: `feat/orders-realtime`

## Tóm tắt
**UI cho buyer + seller đã dựng xong bằng mock** (feature 11/12/13). Feature này làm **backend** và
**thay nguồn dữ liệu** mock → thật: database (`11_orders.sql`) + lib (state/authz/repo/validate) +
API + realtime (SSE + Postgres LISTEN/NOTIFY) → rồi wiring vào UI sẵn có (**không sửa presentational
component**) và **xoá `lib/orders/mock.ts`**. DB là nguồn sự thật; realtime đẩy tín hiệu mỏng → client
refetch. Thanh toán tiền mặt khi nhận hàng.

Luồng trạng thái:
- delivery: `pending → accepted → delivering → arrived → completed`
- pickup:   `pending → accepted → ready → completed`
- huỷ/từ chối: `pending→rejected` (seller) | `(pending|accepted)→cancelled` (buyer);
  `completed` cho phép **cả buyer ("Đã nhận hàng") lẫn seller ("Hoàn tất")**.

Seller dashboard **đã ở `/admin/orders`** (không phải `/seller/orders`).

## Checklist (theo thứ tự phụ thuộc)
- [x] [01_db_orders.md](01_db_orders.md) — `db/init/11_orders.sql`: orders + order_items + order_events
- [x] [02_state_machine.md](02_state_machine.md) — `lib/orders/state.ts` (+test) máy trạng thái thuần
- [x] [03_repo_authz_validate.md](03_repo_authz_validate.md) — repo.ts (+`toOrder`) + authz.ts + orderValidate.ts (+repo.test)
- [ ] [04_api_orders.md](04_api_orders.md) — routes orders POST/GET, [id] GET, status PATCH, seller/orders GET
- [ ] [05_realtime_bus.md](05_realtime_bus.md) — `lib/realtime/bus.ts` LISTEN/NOTIFY + nối pg_notify vào repo
- [ ] [06_api_sse_hook.md](06_api_sse_hook.md) — `api/orders/stream` (SSE) + `lib/useOrderStream.ts`
- [ ] [07_ui_buyer.md](07_ui_buyer.md) — **wiring buyer**: OrderForm→POST, `/orders` + `/orders/[id]` dùng API + stream
- [ ] [08_ui_seller.md](08_ui_seller.md) — **wiring seller**: `/admin/orders` + panel + badge dùng API; gỡ mock
- [ ] [09_finalize.md](09_finalize.md) — verify realtime 2 cửa sổ + lint/test/build + PR

## MUST nhắc lại (AGENTS)
- **SQL chỉ qua `query()`/`withTransaction()`, tham số hoá `$1,$2…`** — never nội suy chuỗi. Schema
  ở `db/init/11_orders.sql` **mới**, additive (không sửa `01_schema.sql`).
- **Validate-at-the-edge** ở mọi route handler trước khi chạm DB (parse body, ép kiểu, chặn range).
- **Giá lấy server-side** từ `menu_items` khi tạo đơn — không tin `price` client gửi.
- **Read-before-write Next 16** (`route.md`) trước khi viết SSE streaming. Route params là `Promise` → `await`.
- **Không sửa presentational component** (badge/timeline/summary/card/form) — chỉ đổi nguồn dữ liệu.
- **Integration test chạm Postgres thật** (test DB), không mock. Logic thuần (state machine) unit test.
- Commit: conventional, **không reference AI**. Theo task-commit-link: commit code → thêm dòng
  `> Commit: <hash> — <msg> ✅` vào đầu file task → commit docs-link riêng.
