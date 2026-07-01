# 03 — Wrapper `apiFetch()` bắn toast khi request fail

## Vì sao
Đây là trọng tâm feature: một điểm duy nhất để mọi API request fail đều báo lỗi từ server nhất quán,
thay vì mỗi component tự xử lý (hoặc nuốt lỗi im lặng).

## Việc
- `src/lib/apiFetch.ts` (module thuần, **không** "use client"):
  - `type ApiFetchOpts = { silent?: boolean; fallbackMessage?: string }`.
  - `async function apiFetch(input: RequestInfo | URL, init?: RequestInit, opts?: ApiFetchOpts):
    Promise<Response>`:
    - `const res = await fetch(input, init)` trong `try`.
    - `res.ok` → return `res` (không toast).
    - `!res.ok` → `const data = await res.json().catch(() => null)`; `message = data?.error ??
      opts.fallbackMessage ?? "Có lỗi xảy ra, thử lại sau."`; nếu `!opts.silent` →
      `emitToast({ kind: "error", message })`. Vẫn **return `res`** để caller tự xử lý tiếp
      (rollback optimistic, đọc field khác…).
    - `catch (err)` (network throw) → nếu `!opts.silent` → `emitToast({ kind:"error", message:
      "Lỗi mạng, kiểm tra kết nối." })`; **rethrow** để caller `catch/finally` cũ vẫn chạy.
  - Bám đúng pattern đọc lỗi hiện có: `(await res.json().catch(() => null)) as { error?: string }`.
- `src/lib/apiFetch.test.ts` (Vitest, mock global `fetch` bằng `vi.fn`):
  - `res.ok` → không emit (spy `subscribe`/`emitToast`).
  - status 400 + `{error:"X"}` → emit message `"X"`, vẫn trả res.
  - status 500 body rỗng/không JSON → emit fallback message.
  - `opts.silent=true` khi fail → không emit.
  - network reject → emit message mạng + `apiFetch` rethrow.

## Done khi
- `pnpm test src/lib/apiFetch.test.ts` xanh, cover 5 case trên.
- `apiFetch` trả `Response` (không nuốt), rethrow network error.
- Không "use client", không chạm DB.
