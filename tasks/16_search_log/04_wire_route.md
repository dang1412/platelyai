# 04 — Wire vào `/api/search`

## Vì sao

Ghi log thật sự xảy ra ở route handler, sau khi đã có `parsed` + `results` + `error` từ extract.

## Việc

Sửa `app/src/app/api/search/route.ts`:

- Thêm `export const runtime = "nodejs";` (cần `fs`; đọc `route.md` nếu phân vân Next 16).
- Import `appendSearchLog`, `type SearchLogEntry` từ `@/lib/searchLog` và `getCurrentUser` từ
  `@/lib/authz`.
- Đổi gọi extract sang chữ ký mới (task 03):
  `const { parsed, error } = await extractQuery(q, vocab);`
  (các bước [2..4] origin/candidates/rerank dùng `parsed` như cũ).
- Sau bước [4] (có `results`), trước `return`:
  - `const userId = (await getCurrentUser())?.id ?? null;`
  - dựng entry:
    `{ ts: new Date().toISOString(), userId, q, location: parsed.location ?? null,
       deviceCoords: coords, origin, parsed, resultCount: results.length, error }`.
  - `void appendSearchLog(entry);` — **không await** (fire-and-forget), không chặn response.
- Response giữ NGUYÊN `{ parsed, results }` — **không** lộ `error` ra client.

Lưu ý: `parsed` từ `extractQuery` luôn là object (có fallback) nên `parsed.location` an toàn.

## Done khi

- Search hoạt động như cũ; mỗi request tạo/append 1 dòng vào `logs/search/<ngày>.jsonl`.
- Khi LLM extract fail → dòng log có `error` là message, `parsed` là fallback, search vẫn trả kết quả.
- Log lỗi (vd dir không ghi được) KHÔNG làm hỏng response search.
- `pnpm lint` + `pnpm build` xanh.
