# 02 — Unit test `searchLog.test.ts`

## Vì sao

Hai hàm thuần là phần dễ sai âm thầm (zero-pad ngày, JSON hợp lệ). Test trực tiếp, không cần fs/DB.

## Việc

Tạo `app/src/lib/searchLog.test.ts` (Vitest, cạnh nguồn):

- `logFileName`:
  - ngày thường → `2026-06-30.jsonl`.
  - boundary zero-pad: tháng & ngày 1 chữ số → `2026-01-05.jsonl` (không `2026-1-5`).
- `formatLogLine`:
  - kết thúc bằng `"\n"`.
  - `JSON.parse(line.trimEnd())` round-trip **bằng** entry gốc (deep equal).
  - entry với `parsed: null`, `userId: null`, `origin: null`, `error: "boom"` vẫn serialize ok
    (giữ field `error`).

KHÔNG test `appendSearchLog` (I/O, đã nuốt lỗi — ngoài phạm vi unit).

## Done khi

- `pnpm test` xanh, các case trên cover zero-pad + round-trip.
