# 13 — Trang admin quản lý đơn cho người bán (mock data)

## Mục tiêu
Cho **seller** (`role='owner'`, và `admin`) xem + xử lý đơn hàng của các quán mình quản lý qua khu
`/admin`, dùng **mock data**. Dựng UI trước (nhận/từ chối/đẩy trạng thái) để tinh chỉnh, **chưa nối
backend** (route/DB realtime là việc plan [`10_orders_realtime`](10_orders_realtime.md)).

Màn hình:
- `/admin/orders` — danh sách đơn của **mọi quán mình quản lý**, lọc theo quán, **nhóm theo trạng thái**.
- `/admin/orders/[id]` — chi tiết 1 đơn + thao tác seller (Nhận / Từ chối / Đẩy trạng thái / Hoàn tất).

## Quyết định mặc định (chỉnh được)
- **Đặt dưới `/admin`** (không phải `/seller` như phác ở plan 10) — tái dùng `admin/layout.tsx`
  (đã guard role ∈ {admin, owner}) + authz `getCurrentUser`/`canEdit`/`listEditableRestaurants`.
- **Mock-only:** không route handler, không DB/AI. Đổi trạng thái = local state mô phỏng (giống dev
  stepper của buyer `OrderTracker`). Plan 10 thay nguồn dữ liệu + transition thật, **không** sửa
  presentational component.
- **Nhóm theo trạng thái** (3 cụm): *Cần xử lý* = `pending`; *Đang làm* = `accepted, delivering,
  arrived, ready`; *Hoàn tất/Huỷ* = `completed, rejected, cancelled`. Mỗi cụm mới nhất trước.
- **Lọc theo quán** bằng `<form method="get">` (server-first, không cần client JS) — như ô search ở
  `/admin/page.tsx`.
- **Style: dùng semantic token** cho màn hình order mới (bám domain order ở feature 11/12, tái dùng
  `OrderStatusBadge`/`OrderStatusTimeline`/`OrderSummary` vốn đã dùng token). Đây là hướng §5 khuyến
  khích; admin shell cũ vẫn để palette literal (migrate ngoài scope).
- **Mock chưa lọc theo quyền thật** (chưa có đơn thật) — hiển thị toàn bộ mock; ghi rõ TODO plan 10
  sẽ lọc theo `restaurant_id` mà user `canEdit`.

## Luồng (server đọc mock; chỉ panel thao tác là client — KHÔNG chạm DB/AI)

```
/admin (home) ──[Quản lý đơn]──► /admin/orders?restaurant=<name>
   listMockOrders() ─► filter theo quán ─► groupSellerOrders()
      ├─ Cần xử lý (pending)      ─► SellerOrderRow… ─► /admin/orders/[id]
      ├─ Đang làm                 ─► SellerOrderRow…
      └─ Hoàn tất/Huỷ             ─► SellerOrderRow…

/admin/orders/[id] (server đọc mock)
   OrderSummary + OrderStatusTimeline + badge
   └─ <SellerActionPanel> ("use client", local state):
        pending → [Nhận đơn] / [Từ chối]
        accepted/delivering/arrived/ready → [<bước kế tiếp>]  (vd "Bắt đầu giao", "Hoàn tất")
        terminal → không thao tác
```

## Backend (chỉ lib thuần, KHÔNG route/DB)
- `app/src/lib/orders/sellerActions.ts` (+ `sellerActions.test.ts`):
  - `groupSellerOrders(orders): { needsAction: Order[]; inProgress: Order[]; done: Order[] }` —
    chia 3 cụm theo status, mỗi cụm sort `createdAt` desc. Tái dùng `isActiveStatus` ở đâu hợp lý.
  - `nextSellerStep(order): { toStatus: OrderStatus; label: string } | null` — bước "đẩy tới" kế
    tiếp theo `flowFor(fulfillment)` (vd pending→accepted "Nhận đơn"; delivery accepted→delivering
    "Bắt đầu giao"; delivering→arrived "Đã tới nơi"; arrived→completed "Hoàn tất"; pickup
    accepted→ready "Sẵn sàng lấy"; ready→completed "Hoàn tất"). Terminal → `null`.
  - `canReject(order): boolean` — chỉ `true` khi `status === 'pending'`.
- `app/src/lib/orders/mock.ts`:
  - Thêm vài đơn `pending`/đa quán để demo cụm + lọc (tái dùng `restaurantName` sẵn có làm khoá lọc).
  - `simulateReject(order): Order` — đặt `rejected` + append event (đối xứng `simulateAdvance` đã có).
  - `restaurantNames(orders): string[]` — danh sách quán distinct cho dropdown lọc (hoặc tính ở page).

## Frontend
- `app/src/app/admin/orders/page.tsx` (**server**): đọc `searchParams.restaurant`, validate (chuỗi,
  rỗng = tất cả), `groupSellerOrders(filter(listMockOrders()))`, render 3 section + `<form method="get">`
  chọn quán. Empty state mỗi cụm. Semantic token, light + dark.
- `app/src/app/admin/orders/[id]/page.tsx` (**server**): `await params`, validate id, `getMockOrder`,
  `notFound()` nếu không có. Render badge + `OrderSummary` + `OrderStatusTimeline` + `<SellerActionPanel>`.
- `app/src/components/admin/SellerOrderRow.tsx` (presentational thuần): quán + badge + SDT + tổng +
  thời gian, link `/admin/orders/[id]`. (Khác `OrderCard` của buyer vì cần SDT + ngữ cảnh seller.)
- `app/src/components/admin/SellerActionPanel.tsx` (`"use client"`): nhận `initialOrder`, giữ local
  state; nút theo `nextSellerStep`/`canReject`, gọi `simulateAdvance`/`simulateReject` cập nhật state.
- `app/src/app/admin/page.tsx`: thêm link **"Quản lý đơn"** → `/admin/orders` (mọi role vào được admin).

## Schema
Không. Mock-only, không thêm `db/init/*.sql` (schema đơn là việc plan 10 — `db/init/11_orders.sql`).

## Bảng file đụng tới
| File | Việc |
| --- | --- |
| `app/src/lib/orders/sellerActions.ts` (+ test) | `groupSellerOrders`, `nextSellerStep`, `canReject` (thuần) |
| `app/src/lib/orders/mock.ts` | thêm đơn pending/đa quán + `simulateReject` (+ helper lọc quán) |
| `app/src/app/admin/orders/page.tsx` | danh sách nhóm theo trạng thái + lọc quán (server) |
| `app/src/app/admin/orders/[id]/page.tsx` | chi tiết đơn + panel thao tác (server + client panel) |
| `app/src/components/admin/SellerOrderRow.tsx` | row tóm tắt đơn cho seller |
| `app/src/components/admin/SellerActionPanel.tsx` | nút thao tác mock (client) |
| `app/src/app/admin/page.tsx` | + link "Quản lý đơn" |

## Test & guardrails
- **Unit (Vitest)**: `groupSellerOrders` (chia 3 cụm, sort desc, rỗng, không mutate); `nextSellerStep`
  (mọi status delivery + pickup, terminal → null); `canReject`. Không DB ở plan này.
- Không route → không integration DB test.
- `pnpm lint && pnpm test && pnpm build` xanh trước PR.
- MUST: validate `searchParams`/`params` ở page; semantic token (không `bg-zinc-*`/hex mới); logic
  thuần tách khỏi component; file ≤200 LOC; light + dark.

## Mở rộng ngoài scope (không làm ở đây)
- Nối API/DB thật + realtime SSE (plan 10): lọc đơn theo quán `canEdit`, transition có kiểm quyền,
  ghi `order_events`, `pg_notify`.
- Thông báo đơn mới (âm thanh/badge số đơn pending trên nav admin).
- Phân trang / lọc theo khoảng thời gian / xuất báo cáo doanh thu.
