# 01 — Toast types + emitter bus

## Vì sao
`apiFetch()` chạy **ngoài** cây React (là module thuần) nên không thể gọi hook để bắn toast. Cần một
emitter module-level làm cầu nối: `apiFetch` gọi `emitToast()`, còn `ToastProvider` subscribe để đưa
vào state React.

## Việc
- `src/lib/toast/types.ts`:
  - `type ToastKind = "error" | "success" | "info"`.
  - `type Toast = { id: string; kind: ToastKind; message: string; duration: number }`.
  - `type ToastInput = { kind?: ToastKind; message: string; duration?: number }` (kind mặc định
    `"error"`, duration mặc định ~4000ms — đặt hằng `DEFAULT_DURATION`).
- `src/lib/toast/bus.ts`:
  - Set/mảng listener module-level. `subscribe(fn): () => void` (trả unsubscribe).
  - `emitToast(input: ToastInput): void` — chuẩn hoá thành `Toast` (sinh `id` bằng
    `crypto.randomUUID()`, áp default kind/duration) rồi gọi mọi listener.
  - Không import React ở file này.
- `src/lib/toast/bus.test.ts` (Vitest):
  - subscribe → `emitToast` gọi listener với đúng message/kind default.
  - nhiều subscriber đều nhận; unsubscribe rồi thì không nhận nữa.
  - default: không truyền kind → `"error"`; có truyền → giữ nguyên.

## Done khi
- `pnpm test src/lib/toast/bus.test.ts` xanh.
- `bus.ts` không import React, không "use client".
- Type export dùng lại được ở provider + apiFetch.
