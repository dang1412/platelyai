# 07 — Finalize (lint/test/build + PR)

## Vì sao
Đảm bảo xanh trước khi mở PR; kiểm luồng end-to-end.

## Việc
- Chạy trong `app/`: `pnpm lint && pnpm test && pnpm build` — phải xanh.
- Kiểm tay (dev): đăng nhập admin → `/admin` → "+ Tạo quán" → nhập tên + "📍 Lấy toạ độ" →
  tạo → tự sang trang sửa quán mới → nhập menu được. Kiểm DB: `location` set đúng.
- Kiểm non-admin (owner) không thấy nút và không vào được `/admin/restaurants/new`.
- Mở PR `feat/admin-create-restaurant` → `main`. Conventional commits, **không reference AI**.

## Done khi
- Lint/test/build xanh; luồng tạo→sửa hoạt động; PR mở.

## Commit / PR
PR: https://github.com/dang1412/platelyai/pull/10
