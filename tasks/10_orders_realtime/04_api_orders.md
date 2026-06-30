# 04 — API routes đơn hàng (REST)

> Commit: 719c7ba — feat(orders): API routes — orders POST/GET, [id] GET, status PATCH, seller/orders GET ✅ (build OK; E2E có session verify ở task 09)

## Vì sao
Lộ repo ra HTTP cho client. Route mỏng: validate-at-the-edge → authz → gọi repo → trả JSON.
Theo pattern các route admin hiện có (`getCurrentUser` + `authzResponse`/`validationResponse`).

## Việc
- `app/src/app/api/orders/route.ts`:
  - `POST` — buyer tạo đơn: `getCurrentUser()` (401 nếu chưa login) → parse body →
    `orderValidate` (task 03) → `createOrder(user.id, input)` → `201 {id}`.
  - `GET` — list đơn của **buyer hiện tại** (`listOrdersForBuyer`). (Seller dùng route riêng bên dưới.)
- `app/src/app/api/orders/[id]/route.ts`:
  - `GET` — `await params`, ép `Number(id)` (400 nếu invalid) → `getOrderFull` → `canViewOrder`
    (404/403 nếu không) → trả `Order` (qua `toOrder`).
- `app/src/app/api/orders/[id]/status/route.ts`:
  - `PATCH` — body `{toStatus, note?}` → load order → `assertCanAct(user, order, toStatus)` →
    `advanceStatus` → trả order mới.
- `app/src/app/api/seller/orders/route.ts`:
  - `GET` — owner/admin: `getCurrentUser()` + chặn role `user` (403) → đọc `searchParams.restaurant`
    (validate optional) → `listOrdersForSeller(user, restaurantId)`; hỗ trợ `?status=pending` để
    badge side menu lấy count (hoặc field `pendingCount`).
- Tất cả: `export const runtime = "nodejs"` (cần pg). Bắt lỗi bằng
  `authzResponse(err) ?? validationResponse(err) ?? 500`. Tham số route là `Promise` → `await params`.

## Done khi
- `POST /api/orders` (đăng nhập) tạo đơn, trả `201 {id}`; thiếu field / quantity≤0 → 400; chưa login → 401.
- `GET /api/orders/[id]` trả đúng đơn cho buyer & seller của quán; user lạ → 403/404.
- `GET /api/seller/orders` trả đơn của quán seller (lọc `restaurant` đúng); role `user` → 403.
- `PATCH .../status` đẩy trạng thái hợp lệ; transition/role sai → 403; trạng thái lạ → 400.
- `pnpm lint` xanh.
