# 09 — Finalize: verify end-to-end + lint/test/build + PR

## Vì sao
Đảm bảo cả luồng chạy thật (realtime giữa 2 người) và sạch trước khi mở PR.

## Việc
- **Verify realtime thủ công (2 cửa sổ/2 tài khoản):**
  - Đăng nhập buyer ở cửa sổ A, seller (owner của quán) ở cửa sổ B (`/admin/orders`).
  - A đặt đơn (thử cả delivery & pickup) → B thấy đơn `pending` **không reload**; badge side menu B tăng.
  - B đẩy: delivery `accepted→delivering→arrived`, pickup `accepted→ready` → A thấy timeline đổi tức thì.
  - A bấm "Đã nhận hàng" (`completed`) hoặc B bấm "Hoàn tất" → cả hai thấy trạng thái cuối.
  - A tắt mạng vài giây rồi bật lại → A reconnect, hiển thị đúng trạng thái hiện tại (bù event lỡ).
  - Authz: user thứ ba mở `/orders/[id]` của đơn không phải mình → bị chặn; role `user` mở
    `/api/seller/orders` → 403.
- **Sạch mock:** `grep -r "orders/mock" app/src` không còn kết quả; `lib/orders/mock.ts` đã xoá.
- **Guardrails cuối:**
  - `pnpm lint && pnpm test && pnpm build` (từ `app/`) đều xanh.
  - Soát lại: SQL đều `$n` (không nội suy); validate-at-the-edge đủ mọi route; presentational component
    không bị sửa; không file nào vượt ~300 LOC chưa tách concern.
- **PR:** branch `feat/orders-realtime` → `main`. Mô tả luồng + quyết định mặc định (1 đơn=1 quán,
  cash-on-pickup, SSE+LISTEN/NOTIFY, `completed` cả hai actor). Conventional commits, **không reference AI**.

## Done khi
- Luồng realtime 2 chiều chạy đúng cả delivery & pickup, bù được event lỡ khi reconnect.
- Mock đã gỡ sạch; `pnpm lint && pnpm test && pnpm build` xanh.
- PR mở, mô tả đầy đủ; checklist `00_overview.md` tick hết.
