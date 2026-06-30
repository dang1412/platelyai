# 04 — Finalize: lint + test + build + PR

## Vì sao

Chốt feature, đảm bảo xanh trước khi merge.

## Việc

- Từ `app/`: `pnpm lint && pnpm test && pnpm build` — tất cả xanh.
- Self-review theo AGENTS §9: SQL tham số hoá, validate edge, không hex/palette lạ ngoài
  neighbor admin, không vượt LOC vô lý.
- Theo memory workflow: commit code (conventional, không reference AI), thêm link commit vào
  các file task, commit docs-link riêng.
- Mở PR `feat/multi-owner` → `main`, mô tả ngắn: model đã nhiều-nhiều sẵn; PR thêm hiển thị list
  owner + gỡ owner; note "why" nếu dùng palette literal theo neighbor admin.

## Done khi

- `pnpm lint && pnpm test && pnpm build` xanh.
- PR mở, mô tả rõ scope + quyết định.
