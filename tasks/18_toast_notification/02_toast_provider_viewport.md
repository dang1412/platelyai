# 02 — ToastProvider + Viewport + useToast, mount trong Providers

## Vì sao
Cần lớp React nhận toast từ bus, giữ trong state, tự huỷ sau `duration`, và render UI ở góc màn
hình. Mount ở root để mọi trang dùng được.

## Việc
- `src/components/toast/ToastProvider.tsx` (`"use client"`):
  - `useState<Toast[]>`. `useEffect` gọi `subscribe(...)` một lần → push toast vào state; cleanup
    unsubscribe.
  - Mỗi toast set `setTimeout(duration)` để tự remove (nhớ clear timer khi unmount / khi remove tay).
  - `remove(id)` để nút đóng gọi. Render `children` + `<ToastViewport toasts={} onClose={} />`.
  - (Tuỳ chọn) cung cấp Context cho `useToast` gọi thủ công — nhưng vì bus đã global, `useToast` có
    thể emit thẳng qua bus mà không cần context. **Chọn: `useToast` emit qua bus** (đơn giản hơn,
    không cần Provider bọc mới dùng được). Provider chỉ lo render.
- `src/components/toast/ToastViewport.tsx` (`"use client"`):
  - `fixed` góc phải-dưới (`fixed bottom-4 right-4`), `z` cao, cột `flex-col gap-2`.
  - Mỗi toast: `bg-surface border border-border rounded-lg shadow`, viền/màu chữ theo kind
    (`text-danger` cho error, `text-success` cho success, `text-foreground` cho info). Nút đóng (×).
  - A11y: container `role="status" aria-live="polite"`. **Chỉ token semantic, không hex.**
- `src/lib/toast/useToast.ts`:
  - Hook trả `{ toast, success, error, info }` — mỗi hàm gọi `emitToast` với kind tương ứng. Không
    cần state; dùng cho chỗ muốn báo thành công (vd "Đã lưu").
- `src/components/Providers.tsx`: bọc `children` bằng `<ToastProvider>` (bên trong
  `SessionProvider`). Không sửa `layout.tsx`.

## Done khi
- App render, gọi thử `emitToast({message:"test"})` (hoặc `useToast().error`) hiện toast góc phải,
  tự biến mất sau ~4s, bấm × đóng ngay.
- Chạy được cả light + dark (kiểm mắt), không có hex/`zinc`/`gray` literal.
- `pnpm lint` xanh, mỗi file ≤200 LOC.
