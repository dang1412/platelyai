# 05 — Finalize (lint/test/build + PR)

> lint sạch · test 122 passed · build OK (/admin/orders + /admin/orders/[id] dynamic) ✅ — PR: chờ xác nhận user.

## Vì sao
Chốt feature, đảm bảo xanh trước khi mở PR (AGENTS §7).

## Việc
- Từ `app/`: `pnpm lint && pnpm test && pnpm build` — tất cả xanh.
- Preview `/admin/orders` + `/admin/orders/[id]` ở **light + dark**: 3 cụm đúng, lọc quán chạy, thao
  tác mock cập nhật trạng thái, empty state ổn.
- Mở PR về `main` từ `feat/admin-order-management`; mô tả ngắn (mock-only, chờ plan 10 nối backend).

## Done khi
- lint/test/build xanh; PR mở, mô tả rõ scope mock.
- (Theo task-commit-link) mỗi task code đã có dòng `> Commit: <hash> …` + commit docs-link riêng.
