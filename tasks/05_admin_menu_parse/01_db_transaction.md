# 01 — `withTransaction` trong `src/lib/db.ts`

**Vì sao:** `query()` chỉ chạy 1 câu, không nguyên tử. `menu/import` cần insert/update nhiều
dòng trong 1 transaction (task 04).

## Việc
- Thêm vào `src/lib/db.ts`:
  ```ts
  export async function withTransaction<T>(
    fn: (q: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
  ): Promise<T>
  ```
  - `pool.connect()` → `BEGIN` → chạy `fn(q)` với `q` bám trên đúng `client` đó →
    `COMMIT`; lỗi → `ROLLBACK` rồi rethrow; `finally client.release()`.
  - `q` trả thẳng `res.rows` (giống `query()`), vẫn tham số hoá `$1,$2…`.

## Done khi
- `pnpm lint` xanh, type khớp với cách dùng dự kiến ở task 04.
- Không tạo `Pool` mới — tái dùng `pool` đã export (AGENTS §3).

## Commit
https://github.com/dang1412/platelyai/commit/46279f504f3a6822e8ba1acc29ff43c3818f3498
