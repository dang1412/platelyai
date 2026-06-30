# Feature 16 — Search log của user (file theo ngày)

Plan: [`plans/16_search_log.md`](../../plans/16_search_log.md)

Branch đề xuất: `feat/search-log`

## Bối cảnh (đọc trước)

`/api/search` (`app/src/app/api/search/route.ts`) chạy 4 bước extract → origin → candidates →
rerank rồi trả `{ parsed, results }`. Feature này **chỉ thêm ghi log** mỗi lượt search ra
**file JSONL theo ngày** (`logs/search/YYYY-MM-DD.jsonl`), fire-and-forget, **không đổi schema**,
**không đổi response**, không có UI. Lỗi ghi log không được làm vỡ search. Bản ghi **gồm cả lỗi
nếu gọi LLM extract fail** (field `error`).

## Checklist (theo thứ tự phụ thuộc)

- [x] `01_searchlog_lib.md` — `src/lib/searchLog.ts`: type (gồm `error`) + `logFileName` + `formatLogLine` + `appendSearchLog`
- [x] `02_searchlog_test.md` — `src/lib/searchLog.test.ts`: unit cho 2 hàm thuần
- [x] `03_extract_error.md` — `src/lib/extract.ts`: `extractQuery` trả `{ parsed, error }` (surface lỗi LLM, vẫn fallback)
- [x] `04_wire_route.md` — sửa `search/route.ts`: `runtime="nodejs"` + destructure `{parsed,error}` + `appendSearchLog` fire-and-forget
- [x] `05_finalize.md` — gitignore `/logs` + document `SEARCH_LOG_DIR`, lint + test + build xanh, mở PR

Code: `0a2a454` (PR #28, lint + test + build xanh).

## Nhắc lại MUST (AGENTS.md)

- **Không DB, không AI** trong feature này → không có vấn đề SQL injection; vẫn KHÔNG tạo Pool mới.
- **Fire-and-forget + nuốt lỗi:** `appendSearchLog` phải try/catch, **không throw** ra route.
- **Tách concern:** hàm thuần (`logFileName`, `formatLogLine`) tách khỏi I/O để unit test không cần fs.
- **Next 16:** route cần `export const runtime = "nodejs"` để dùng `fs` (đọc `route.md` nếu phân vân).
- **Never commit** file log (`/logs`) hay `.env*` (trừ `.env.example`).
- File ≤200 LOC; `searchLog.ts` nhỏ gọn, một việc.
