# 04 — Finalize: lint/test/build + PR

## Vì sao

Chốt feature: đảm bảo xanh toàn bộ trước khi mở PR theo §7 AGENTS.

## Việc

- Từ `app/`: `pnpm lint && pnpm test && pnpm build` — phải xanh cả ba.
- Soát lại:
  - `db/init/04_menu_search_vec.sql` đã chạy tay lên DB dev; backfill xong; index dùng được.
  - `dishes.ts` ≤300 LOC, comment khớp hành vi mới.
  - Không lộ secret, không commit `.env*`.
- Commit theo conventional commits (không reference AI), vd:
  `feat(search): gộp category+tên món vào search_vec, match phraseto+plainto`.
- Mở PR về `main` (branch `feat/dish-combined-search`) — **chờ user xác nhận** trước khi tạo PR.
- Tick checklist trong `00_overview.md`, thêm link commit vào từng task đã xong (không tạo commit
  docs riêng).

## Kết quả

- `pnpm lint` sạch · `pnpm test` 89/89 · `pnpm build` OK (2026-06-26).
- `dishes.ts` 225 LOC (<300). Không có `.env` trong diff. 7 commit ahead `main`.
- DB backup trước thay đổi: `backups/plately_20260626_111155.dump` (pg_dump -Fc, local-only).
- **PR: chờ user xác nhận** trước khi push `feat/dish-combined-search` + mở PR.

## Done khi

- `pnpm lint && pnpm test && pnpm build` xanh.
- PR mở (sau khi user đồng ý) mô tả: cột `search_vec`, trigger maintain, bỏ category-only, tier dist.
