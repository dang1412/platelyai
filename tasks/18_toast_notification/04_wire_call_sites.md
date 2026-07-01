# 04 — Đổi các `fetch()` client sang `apiFetch()`

## Vì sao
Hạ tầng xong nhưng chưa có tác dụng tới khi call-site dùng nó. Ưu tiên nơi đang **nuốt lỗi im lặng**
để user thấy được lỗi server.

## Việc
Đổi `fetch("/api/…")` → `apiFetch("/api/…")` ở các client component, theo thứ tự ưu tiên:
- **Nuốt lỗi im lặng (làm trước):**
  - `src/components/FavoriteButton.tsx` — `!res.ok`/catch đang rollback im lặng: dùng `apiFetch`
    (auto-toast), giữ nguyên rollback optimistic.
  - `src/components/admin/SellerActionPanel.tsx` — `catch {}` im lặng khi PATCH status.
  - `src/components/OrderTracker.tsx` — fetch trong tracker.
- **Đã có inline error (cân nhắc):** `InfoForm`, `OrderForm`, `profile/page`, `orders/page`,
  `favorites/page`, `RestaurantModal`, `page.tsx`, `AuthButton`.
  - Mặc định: **giữ inline cho lỗi validate tại form**; với lỗi mạng/500 dùng `apiFetch` (có thể
    `opts.silent` ở chỗ đã tự hiển thị lỗi để tránh double-report). Ghi "why" nếu để silent.
- Rà nhanh: các route liên quan có trả `{ error }` khi fail không — nếu route nào trả lỗi không có
  field `error`, note lại (sửa nếu trivial, còn không để ngoài scope).

## Done khi
- `FavoriteButton`, `SellerActionPanel`, `OrderTracker` khi API fail → hiện toast lỗi (thử bằng
  cách tắt server/route trả 500).
- Không component nào bị **double-report** (vừa inline vừa toast) ngoài ý muốn.
- `pnpm lint && pnpm test` xanh.
