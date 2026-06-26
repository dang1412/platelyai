# 04 — UI: bỏ badge category ở trang search

> Commit: `4097d72` — feat(search): bỏ badge category ở trang search ✅

## Vì sao
`ParsedQuery.category` đã bị bỏ (task 02); badge 🍽/🥤 không còn nguồn. food/drink giờ hiện tự
nhiên trong list `parsed.tags`.

## Việc
- `app/src/app/page.tsx`: xoá block `{parsed.category && (…)}` (≈ dòng 142–146). Giữ nguyên block
  render `parsed.tags` phía dưới (type-tag sẽ hiện ở đó như tag thường).
- Không thêm `"use client"`; giữ server-first.

## Done khi
- `pnpm build` xanh, không lỗi type (`parsed.category` không còn).
- Search ca không-có-món: type-tag hiện trong dải tag, không còn badge riêng.
