# 05 — Finalize (gitignore + env doc + xanh + PR)

## Vì sao

Không để file log lọt vào git, document biến cấu hình, và chốt chất lượng trước PR.

## Việc

- `app/.gitignore`: thêm mục ignore `/logs` (nằm trong `app/logs/...`).
- `.env.example`: thêm dòng document `SEARCH_LOG_DIR` (tuỳ chọn, default `./logs/search`) — giải
  thích ngắn: thư mục ghi search log JSONL theo ngày.
- Verify thủ công: chạy dev, search 1 câu, kiểm tra `app/logs/search/<ngày>.jsonl` có dòng JSON
  đúng field (ts, userId, q, location, deviceCoords, origin, parsed, resultCount, error). Thử
  ca lỗi LLM (vd đổi sai `GEMINI_API_KEY` để ép Gemini fail) → dòng log có `error` message.
- `cd app && pnpm lint && pnpm test && pnpm build` — tất cả xanh.
- Mở PR `feat/search-log` → `main`. Commit conventional: `feat(search): ghi search log file theo ngày`.

## Done khi

- `/logs` được gitignore, log không xuất hiện trong `git status`.
- `.env.example` có `SEARCH_LOG_DIR`.
- lint + test + build xanh; PR mở.
- (Theo workflow task) thêm link commit vào `00_overview.md` sau khi merge.
