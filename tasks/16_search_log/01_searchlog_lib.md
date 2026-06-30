# 01 — Lib `searchLog.ts`

## Vì sao

Cần một chỗ duy nhất để dựng tên file theo ngày, serialize bản ghi, và append ra disk —
tách phần thuần (test được) khỏi phần I/O (fs).

## Việc

Tạo `app/src/lib/searchLog.ts`:

- `export type SearchLogEntry = { ts: string; userId: number | null; q: string;
  location: string | null; deviceCoords: LatLng | null; origin: LatLng | null;
  parsed: ParsedQuery | null; resultCount: number; error: string | null }`
  (import `LatLng`, `ParsedQuery` từ `./types`). `error` = message lỗi LLM extract, `null` nếu không lỗi.
- `export function logFileName(date: Date): string` — **thuần**, trả `YYYY-MM-DD.jsonl` theo
  **ngày local** (zero-pad tháng/ngày). Không phụ thuộc env, không I/O.
- `export function formatLogLine(entry: SearchLogEntry): string` — **thuần**,
  `JSON.stringify(entry) + "\n"`.
- `export async function appendSearchLog(entry: SearchLogEntry): Promise<void>` — I/O:
  - dir = `process.env.SEARCH_LOG_DIR ?? "./logs/search"`.
  - `await fs.mkdir(dir, { recursive: true })`; `await fs.appendFile(join(dir,
    logFileName(new Date(entry.ts))), formatLogLine(entry))`.
  - **Toàn bộ trong try/catch**: lỗi → `console.error("appendSearchLog failed:", e)` rồi return.
    KHÔNG throw.
  - dùng `import { promises as fs } from "node:fs"` + `import { join } from "node:path"`.

## Done khi

- File tạo, ≤200 LOC, một concern (logging).
- 2 hàm thuần không gọi I/O; `appendSearchLog` không bao giờ throw.
- `pnpm lint` xanh (không import thừa, type chặt).
