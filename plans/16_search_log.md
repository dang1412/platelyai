# Plan 16 — Search log của user (file theo ngày)

## Mục tiêu

Ghi lại mỗi lượt search ở `/api/search` ra **file log theo ngày** để phân tích sau (user hỏi
gì, ở đâu, hiểu ra sao). Không có UI; chỉ ghi append, fire-and-forget, **không được làm vỡ
luồng search** nếu ghi log lỗi.

Mỗi bản ghi gồm: **thời gian**, **query thô**, **location** (text trong câu), **toạ độ**
(device coords + origin đã resolve), **kết quả extract** (ParsedQuery) + số kết quả trả về,
**và lỗi nếu gọi LLM extract fail** (field `error`).

## Quyết định mặc định (chỉnh được)

- **Lưu file, KHÔNG lưu DB.** Theo yêu cầu "ghi tên file theo ngày". Không thêm schema/bảng.
- **Format JSONL** (1 JSON / dòng), append-only. Dễ `cat`/`jq`, không cần đọc-sửa-ghi.
- **Tên file theo ngày local:** `YYYY-MM-DD.jsonl` (vd `2026-06-30.jsonl`).
- **Thư mục:** `process.env.SEARCH_LOG_DIR` (default `./logs/search`, tính theo cwd = `app/`).
  Gitignore — không commit log.
- **Fire-and-forget:** route không `await` chặn response; lỗi ghi log nuốt (chỉ `console.error`).
- **userId** lấy từ session nếu đăng nhập, `null` nếu khách (search là route công khai).
- Caveat: filesystem trên serverless có thể **ephemeral** (mất khi redeploy/scale). Đủ cho
  dev/self-host; nếu deploy serverless cần đổi sink (xem "Mở rộng").

## Luồng

```
GET /api/search?q=&lat=&lng=   (runtime = "nodejs" để có fs)
  [1] extract → { parsed, error }   ← extract trả thêm error (lỗi gọi LLM), vẫn fallback nếu fail
  [2..4] origin → candidates → rerank   (như cũ, KHÔNG đổi)
  [5] build SearchLogEntry { ts, userId, q, location, deviceCoords, origin, parsed, resultCount, error }
      → appendSearchLog(entry)   ← fire-and-forget, không await chặn, nuốt lỗi
  return Response.json({ parsed, results })   (như cũ — KHÔNG lộ error ra client)
```

> **Vì sao extract phải trả error:** hiện `extractQuery` **nuốt** lỗi LLM (catch → trả fallback)
> nên route không biết để ghi. Cần extract surface lỗi ra ngoài mà **vẫn** giữ fallback (search
> không vỡ). Đây là phần thay đổi thật sự ngoài lib log mới.

Ranh giới: toàn bộ ở **server** (route handler). `appendSearchLog` chạm **filesystem** (Node fs),
không chạm DB/AI. Lấy user qua `getCurrentUser()` (đã có, đọc session).

## Backend

### `src/lib/searchLog.ts` (lib mới)

Tách phần **thuần** (test được, không I/O) khỏi phần I/O:

- `type SearchLogEntry` — `{ ts, userId, q, location, deviceCoords, origin, parsed, resultCount, error }`
  (`error: string | null` — message lỗi LLM extract, `null` nếu không lỗi).
- `logFileName(date: Date): string` — **thuần** → `YYYY-MM-DD.jsonl` theo ngày local.
- `formatLogLine(entry: SearchLogEntry): string` — **thuần** → `JSON.stringify(entry) + "\n"`.
- `appendSearchLog(entry): Promise<void>` — I/O: `fs.mkdir(dir,{recursive:true})` +
  `fs.appendFile(path, formatLogLine(entry))`; **try/catch nuốt lỗi** + `console.error`.
  Đọc dir từ `SEARCH_LOG_DIR` (default `./logs/search`).

### `src/lib/extract.ts` (sửa — surface lỗi LLM)

- Đổi `extractQuery` trả `Promise<{ parsed: ParsedQuery; error: string | null }>` thay vì
  `Promise<ParsedQuery>`.
- Trong nhánh catch (gọi Gemini fail): vẫn `console.error` + **không cache**, nhưng giữ lại
  message lỗi để trả `error: String(e)` (hoặc `e.message`). Ca thành công / thiếu key / q rỗng →
  `error: null`.
- Caller duy nhất là route → cập nhật cùng lúc (task 04). `parseExtraction` (hàm thuần) **không
  đổi** → test hiện có không vỡ.

### `src/app/api/search/route.ts` (sửa)

- Thêm `export const runtime = "nodejs";` (cần fs — App Router file conventions, route.md).
- `const { parsed, error } = await extractQuery(q, vocab);` (destructure chữ ký mới).
- Sau khi có `results`: dựng `SearchLogEntry` (gồm `error`), gọi `appendSearchLog(entry)`
  **không await** (`void appendSearchLog(...)`) để không trì hoãn response.
- Lấy `userId`: `(await getCurrentUser())?.id ?? null` — `getCurrentUser` từ `@/lib/authz`.
- Response giữ NGUYÊN `{ parsed, results }` — **không** lộ `error` ra client.
- Validate-at-the-edge giữ nguyên (q.trim, coordsFromParams đã chặn range).

## Frontend

Không có. Feature thuần backend logging.

## Schema

Không đổi DB. Không thêm `db/init/*.sql`.

## Bảng file đụng tới

| File | Việc |
| --- | --- |
| `app/src/lib/searchLog.ts` | **mới** — type (gồm `error`) + `logFileName` + `formatLogLine` + `appendSearchLog` |
| `app/src/lib/searchLog.test.ts` | **mới** — unit cho 2 hàm thuần |
| `app/src/lib/extract.ts` | **sửa** — `extractQuery` trả `{ parsed, error }` (surface lỗi LLM, vẫn fallback) |
| `app/src/app/api/search/route.ts` | **sửa** — `runtime="nodejs"` + destructure `{parsed,error}` + `appendSearchLog` fire-and-forget |
| `app/.gitignore` | **sửa** — ignore `/logs` |
| `.env.example` | **sửa** — document `SEARCH_LOG_DIR` (tuỳ chọn) |

## Test & guardrails

- **Unit** (`searchLog.test.ts`, không I/O):
  - `logFileName` ra đúng `YYYY-MM-DD.jsonl` cho ngày cho trước (test boundary tháng/ngày 1 chữ số → zero-pad).
  - `formatLogLine` ra JSON hợp lệ, có newline cuối, round-trip `JSON.parse` bằng entry gốc.
- **Không** integration test (không chạm DB; fs append đơn giản, nuốt lỗi). Đủ với unit.
- Guardrail: `appendSearchLog` **không bao giờ throw** ra route — đảm bảo bằng try/catch.
- `pnpm lint && pnpm test && pnpm build` xanh trước PR.

## Mở rộng ngoài scope (không làm bây giờ)

- Trang admin xem/đọc log, lọc theo ngày/user.
- Đổi sink sang DB/bảng `search_logs` hoặc dịch vụ ngoài nếu deploy serverless (FS ephemeral).
- Log thêm latency từng bước (extract/geocode/candidates) để đo hiệu năng.
- Rotate/nén file cũ.
