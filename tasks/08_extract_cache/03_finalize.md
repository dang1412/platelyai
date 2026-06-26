# 03 — Finalize: lint/test/build + PR

## Vì sao

Chốt feature, đảm bảo xanh trước PR theo §7 AGENTS.

## Việc

- Từ `app/`: `pnpm lint && pnpm test && pnpm build` — xanh cả ba.
- Soát:
  - `extractCache.ts` không import DB/mạng; `extract.ts` không đổi chữ ký công khai.
  - Chỉ cache kết quả Gemini thành công; fallback/lỗi không cache.
  - Không lộ secret, không commit `.env*`, không thêm dependency.
- Commit conventional (không reference AI), vd:
  `feat(search): cache in-memory kết quả extract + single-flight`.
- Mở PR về `main` (branch `feat/extract-cache`) — **chờ user xác nhận** trước khi tạo PR. Mô tả nêu:
  cache theo `q`+vocabSig, single-flight, chỉ cache thành công, in-memory per-process (Redis sau).
- Tick checklist `00_overview.md` + thêm link commit từng task (commit docs-link riêng).

## Kết quả

- `pnpm lint` sạch · `pnpm test` 96/96 · `pnpm build` OK (2026-06-26).
- `extractCache.ts` 82 LOC · `extract.ts` 139 LOC (<300). Không `.env` trong diff, không thêm dependency.
- 5 commit ahead `main`. **PR: chờ user xác nhận** trước khi push `feat/extract-cache`.

## Done khi

- `pnpm lint && pnpm test && pnpm build` xanh.
- PR mở (sau khi user đồng ý) đúng mô tả phạm vi + ghi rõ giới hạn multi-instance.
