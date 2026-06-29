# 04 — Finalize (lint/test/build + PR)

> lint sạch · test 116 passed · build OK ✅ — PR: chờ xác nhận user.

## Vì sao
Chốt feature, đảm bảo xanh trước khi mở PR (AGENTS §7).

## Việc
- Từ `app/`: `pnpm lint && pnpm test && pnpm build` — tất cả xanh.
- Preview `/orders` ở **light + dark**: 2 nhóm hiển thị đúng, empty state ổn, click sang chi tiết.
- Kiểm side menu: link "Đơn của tôi" hiện đúng khi login.
- Mở PR về `main` từ `feat/order-history`; mô tả ngắn (mock-only, chờ plan 10 nối backend).

## Done khi
- lint/test/build xanh; PR mở, mô tả rõ scope mock.
- (Theo task-commit-link) mỗi task code đã có dòng `> Commit: <hash> …` + commit docs-link riêng.
