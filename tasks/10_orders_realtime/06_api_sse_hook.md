# 06 — SSE endpoint + client hook

## Vì sao
Đưa tín hiệu từ bus (task 05) xuống browser qua Server-Sent Events (1 chiều server→client, đủ
cho thông báo, nhẹ hơn WebSocket). Client nhận tín hiệu → **refetch** trạng thái chuẩn (DB là
nguồn sự thật). Reconnect → refetch để bù event lỡ.

## Việc
- **Read-before-write (MUST §2):** đọc
  `app/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
  phần streaming `Response`/`ReadableStream` trong Next 16 trước khi viết.
- `app/src/app/api/orders/stream/route.ts` (`export const runtime = "nodejs"`):
  - `GET` — `getCurrentUser()` (401 nếu chưa login).
  - Trả `ReadableStream`, headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
    `Connection: keep-alive`.
  - `start(controller)`: `bus.subscribe(user.id, payload => controller.enqueue("data: "+JSON.stringify(payload)+"\n\n"))`.
  - **Heartbeat** `: ping\n\n` mỗi ~25s (giữ kết nối qua proxy/idle timeout).
  - Cleanup: nghe `request.signal` `'abort'` → `unsubscribe()` + clear heartbeat + `controller.close()`.
- `app/src/lib/useOrderStream.ts` (`"use client"`):
  - mở `new EventSource('/api/orders/stream')` (tự reconnect).
  - `onmessage` → parse → gọi `onEvent(payload)` (caller dùng để refetch đơn liên quan).
  - `onopen` → gọi `onEvent` không tham số (trigger refetch bù lỡ khi (re)connect).
  - đóng `EventSource` khi unmount.

## Done khi
- Mở `/api/orders/stream` khi đã login giữ kết nối mở, thấy `: ping` định kỳ; chưa login → 401.
- Gọi `PATCH .../status` ở tab khác → tab đang stream nhận `data: {...}` gần như tức thì.
- Đóng tab → server `unsubscribe` (không rò controller); ngắt mạng client rồi nối lại →
  EventSource tự reconnect và `onopen` chạy.
- `pnpm lint` xanh.
