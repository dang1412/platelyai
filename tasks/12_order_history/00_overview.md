# Feature 12 — Trang lịch sử đơn (mock) + link side menu

Plan: [`plans/12_order_history.md`](../../plans/12_order_history.md)

Branch đề xuất: `feat/order-history`

## Tóm tắt
Nâng cấp `/orders` (đã có từ feature 11) thành trang **lịch sử đơn** dùng **mock data**, tách 2
nhóm **Đang xử lý** / **Lịch sử**, và thêm link **"Đơn của tôi"** vào side menu (`AuthButton`) khi
đã đăng nhập. Mock-only — không DB/AI/route.

## Checklist (theo thứ tự phụ thuộc)
- [x] [01_group_logic.md](01_group_logic.md) — `isActiveStatus` + `groupOrders` trong `statusMeta.ts` (+ test)
- [ ] [02_orders_page.md](02_orders_page.md) — nâng cấp `/orders` thành 2 nhóm + empty state
- [ ] [03_menu_link.md](03_menu_link.md) — link "Đơn của tôi" trong side menu `AuthButton`
- [ ] [04_finalize.md](04_finalize.md) — lint/test/build + preview light+dark + PR

## MUST nhắc lại (AGENTS)
- **Logic phân nhóm thuần** ở `lib/orders/statusMeta.ts` + **unit test** cạnh file — không nhét vào component.
- **Semantic token** ở UI (§5, rule #4) — không `bg-zinc-*`/`text-gray-*`/hex mới. Bám style hàng xóm.
- **Server-first**; `/orders` cần `"use client"` (đã có) vì dùng `useRouter`. Giữ tối thiểu.
- File ≤200 LOC, tách theo *concern*; chạy được **light + dark**.
- Commit: conventional, **không reference AI**. Theo task-commit-link: commit code → thêm dòng
  `> Commit: <hash> — <msg> ✅` vào đầu file task → commit docs-link riêng.
