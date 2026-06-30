# 07 — Finalize (lint/test/build + PR)

## Vì sao

Chốt feature: xanh CI cục bộ trước khi mở PR (AGENTS §7).

## Việc

- Từ `app/`: `pnpm lint && pnpm test && pnpm build` — phải xanh.
- Rà lại: không raw hex / palette literal ngoài-token trong JSX mới; SQL tham số hoá; validate ở
  route; không commit `.env*`.
- Mở PR `feat/buyer-profile` → `main`, conventional commit, **không reference AI** trong message.
- Mô tả PR: tóm tắt feature, link `plans/14_buyer_profile.md`.

## Done khi

- `lint` + `test` + `build` xanh.
- PR mở, mô tả đầy đủ, branch đúng convention.
