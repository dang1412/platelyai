# Feature 18 — Toast notification + báo lỗi server khi API fail

Plan: [`plans/18_toast_notification.md`](../../plans/18_toast_notification.md)

Hệ thống toast client-side dùng chung. Trọng tâm: API request fail → tự bắn toast đọc `{ error }`
từ server. Tự dựng (không thêm dependency), trigger qua wrapper `apiFetch()`.

## Branch đề xuất
`feat/toast-notification`

## Checklist (theo thứ tự phụ thuộc)
- [x] `01_toast_bus_types.md` — types + emitter bus module-level (+ test)
- [x] `02_toast_provider_viewport.md` — ToastProvider + ToastViewport + useToast, mount trong Providers
- [x] `03_api_fetch.md` — wrapper `apiFetch()` bắn toast khi fail (+ test)
- [x] `04_wire_call_sites.md` — đổi các `fetch()` client nuốt lỗi sang `apiFetch()`
- [x] `05_finalize.md` — lint/test/build + PR

> Toàn bộ feature commit ở `2a8392e` (thêm cả toast khi search extract/Gemini lỗi).

## Nhắc lại các MUST (AGENTS)
- **Design token:** chỉ semantic token (`text-danger`, `bg-surface`, `border`…), **không** hex /
  `bg-zinc-*` / `text-gray-*` / `[13px]`. Thiếu token → thêm vào `@theme` (light + dark) trước.
- **Dark mode:** toast phải đọc được cả light + dark.
- **`"use client"`** chỉ ở component cần state/effect (ToastProvider/Viewport). Lib bus/apiFetch là
  module thuần, không đánh dấu client.
- **File ≤200 LOC**, tách theo concern.
- Không chạm SQL/DB, không thêm ORM. Không reference AI trong commit message.
- Test đặt cạnh nguồn (`*.test.ts`), `pnpm lint && pnpm test && pnpm build` xanh trước PR.
