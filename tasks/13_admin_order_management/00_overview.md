# Feature 13 — Trang admin quản lý đơn cho người bán (mock)

Plan: [`plans/13_admin_order_management.md`](../../plans/13_admin_order_management.md)

Branch đề xuất: `feat/admin-order-management`

## Tóm tắt
Cho seller (owner/admin) xem + xử lý đơn của quán mình quản lý dưới `/admin`, dùng **mock data**.
`/admin/orders` (lọc theo quán, **nhóm theo trạng thái**) + `/admin/orders/[id]` (chi tiết + thao
tác Nhận/Từ chối/Đẩy trạng thái). Mock-only — không DB/AI/route (backend là plan 10).

## Checklist (theo thứ tự phụ thuộc)
- [x] [01_seller_logic.md](01_seller_logic.md) — `sellerActions.ts`: `groupSellerOrders`, `nextSellerStep`, `canReject` (+ test)
- [x] [02_mock_data.md](02_mock_data.md) — mở rộng `mock.ts`: đơn pending/đa quán + `simulateReject` + lọc quán
- [x] [03_orders_list.md](03_orders_list.md) — `/admin/orders` nhóm trạng thái + lọc quán + `SellerOrderRow` + link từ `/admin`
- [x] [04_order_detail.md](04_order_detail.md) — `/admin/orders/[id]` + `SellerActionPanel` (mock transitions)
- [ ] [05_finalize.md](05_finalize.md) — lint/test/build + preview light+dark + PR

## MUST nhắc lại (AGENTS)
- **Validate at the edge:** parse/validate `searchParams.restaurant` và `params.id` trước khi dùng.
- **Logic thuần** (`sellerActions`) tách khỏi component + **unit test** cạnh file; không DB ở plan này.
- **Server-first:** 2 page là server component đọc mock; chỉ `SellerActionPanel` là `"use client"`.
- **Semantic token** cho màn hình order mới (§5, rule #4) — không `bg-zinc-*`/`text-gray-*`/hex mới.
- File ≤200 LOC, tách theo *concern*; chạy được **light + dark**.
- Commit: conventional, **không reference AI**. Theo task-commit-link: commit code → thêm dòng
  `> Commit: <hash> — <msg> ✅` vào đầu file task → commit docs-link riêng.
