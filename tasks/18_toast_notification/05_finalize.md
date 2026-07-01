# 05 — Finalize (lint/test/build + PR)

## Vì sao
Chốt feature: đảm bảo xanh toàn bộ và mở PR.

## Việc
- Từ `app/`: `pnpm lint && pnpm test && pnpm build` — sửa tới khi xanh.
- Kiểm mắt light + dark: toast hiện đúng màu theo kind, auto-dismiss, nút đóng chạy.
- Rà guardrails: không hex/`zinc`/`gray` literal, file ≤200 LOC, không SQL/ORM, `"use client"` chỉ ở
  component cần.
- Commit theo conventional (`feat: toast notification + báo lỗi server khi API fail`), **không**
  reference AI. Mở PR về `main` từ `feat/toast-notification`.
- Theo workflow task-commit-link: sau khi commit code, thêm link commit vào file task rồi commit
  docs-link riêng.

## Done khi
- `pnpm lint && pnpm test && pnpm build` xanh.
- PR mở, mô tả ngắn gọn feature + quyết định (tự dựng, apiFetch wrapper).
