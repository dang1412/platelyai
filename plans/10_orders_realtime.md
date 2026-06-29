# 10 — Đặt món + theo dõi trạng thái realtime (backend cho UI đã có)

> **Trạng thái (2026-06-29):** UI cho cả buyer lẫn seller đã dựng xong bằng **mock data** qua
> feature [11](11_buyer_order_ui.md) / [12](12_order_history.md) / [13](13_admin_order_management.md).
> Plan này **viết lại để tập trung backend**: database + API + realtime, rồi **thay nguồn dữ liệu**
> mock → thật trong UI sẵn có (không sửa presentational component).

## Mục tiêu
Cho **buyer** (`role='user'`) đặt món từ một quán (giao hàng / lấy tại quầy, nhập SDT); **seller**
(`role='owner'` của quán, hoặc `admin`) nhận đơn và đẩy trạng thái; cả hai thấy cập nhật **realtime**
không cần reload. Thay toàn bộ `lib/orders/mock.ts` bằng dữ liệu thật từ Postgres.

## Đã có (KHÔNG làm lại trong plan này)
- **Kiểu dùng chung:** `src/lib/orders/types.ts` — `Fulfillment`, `OrderStatus`, `OrderItem`,
  `OrderEvent`, `Order` (id:string, `restaurantName`, `phone`, `total`, `createdAt` ISO…).
- **Logic thuần trình bày:** `statusMeta.ts` (`STATUS_LABEL`, `statusTone`, `flowFor`,
  `timelineSteps`, `isActiveStatus`, `groupOrders`) + `sellerActions.ts` (`groupSellerOrders`,
  `nextSellerStep`, `canReject`) — đều có unit test.
- **Component (presentational, dùng token):** `OrderForm`, `OrderCard`, `OrderStatusBadge`,
  `OrderStatusTimeline`, `OrderSummary`, `OrderTracker`, `admin/SellerOrderRow`,
  `admin/SellerActionPanel`; `RestaurantModal` đã có nút "Đặt món".
- **Trang:** buyer `/orders` (lịch sử, nhóm), `/orders/[id]` (theo dõi), `/order/[restaurantId]`
  (deep-link mở modal); seller `/admin/orders` (nhóm trạng thái + lọc quán), `/admin/orders/[id]`
  (chi tiết + thao tác). Side menu có link + **badge số đơn pending** (đang đếm từ mock).
- **Mock cần gỡ:** `src/lib/orders/mock.ts` (`listMockOrders`, `getMockOrder`, `simulateAdvance`,
  `simulateReject`, `restaurantNames`) + dev stepper trong `OrderTracker`.

> ⚠️ **Lệch route:** plan cũ ghi seller ở `/seller/orders`; thực tế đã làm ở **`/admin/orders`**
> (dưới `admin/layout.tsx`, đã guard role ∈ {admin, owner}). Plan này theo `/admin/orders`.

## Còn lại (scope plan này): DATABASE → LIB → API → REALTIME → WIRING

## Quyết định mặc định (chỉnh được)
- **1 đơn = 1 quán** (không giỏ hàng đa-quán). Buyer **bắt buộc đăng nhập**; SDT chỉ là liên hệ giao.
- **Thanh toán tiền mặt khi nhận/lấy** — MVP không cổng thanh toán online.
- **Realtime = SSE + Postgres LISTEN/NOTIFY** (cần deploy **server Node chạy liên tục** — không
  serverless). DB là nguồn sự thật; realtime đẩy tín hiệu mỏng → client **refetch**. Không thêm Redis.
  *Escape hatch:* nếu hạ tầng là serverless → tạm thay SSE bằng short-poll trong `useOrderStream`
  (cùng API), nâng cấp sau.
- **`completed` cho phép cả hai actor:** buyer bấm "Đã nhận hàng" **hoặc** seller bấm "Hoàn tất"
  (đúng UI đã làm). `state.ts` là nguồn sự thật transition; helper UI (`nextSellerStep`,
  nút buyer) phải bám theo nó (xem mục Wiring).

## Luồng

```
DELIVERY:  pending → accepted(chuẩn bị) → delivering(đang giao) → arrived(đã tới) → completed
PICKUP:    pending → accepted(chuẩn bị) → ready(sẵn sàng lấy)                      → completed
Huỷ/từ chối: pending→rejected(seller) | (pending|accepted)→cancelled(buyer)
```

```
Buyer (browser)            Server (Node, chạy liên tục)            Seller (browser)
  │  POST /api/orders ───────────►  withTransaction:                    │
  │                                  INSERT orders+items+event(pending) │
  │                                  pg_notify('order_channel', payload)│
  │                                         │                            │
  │  EventSource /api/orders/stream         │  bus: LISTEN order_channel │  EventSource …/stream
  │◄────── data: {orderId,status} ──────────┴── fan-out theo user_id ──►│ (đơn pending hiện ra)
  │  refetch GET /api/orders/[id]                                        │  PATCH …/status → notify
  │◄──────────────────── đổi trạng thái tức thì ───────────────────────►│
```

- **Chạm DB:** mọi route qua `query()`/`withTransaction()` (`src/lib/db.ts`). **Không AI** ở feature này.
- **Realtime push** chỉ khi tab mở (SSE). Reconnect → refetch để bù event lỡ.

## 1) Database — `db/init/11_orders.sql` (additive, KHÔNG sửa file đã apply, §4)
`BIGSERIAL` id, `snake_case`, **`TIMESTAMPTZ`** cho mốc state-change, snapshot giá/tên món.

```
orders(
  id BIGSERIAL PK,
  buyer_id BIGINT NOT NULL REFERENCES users(id),
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN ('delivery','pickup')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','delivering','arrived','ready',
                      'completed','rejected','cancelled')),
  buyer_phone TEXT NOT NULL,
  delivery_address TEXT,                 -- NULL khi pickup
  delivery_lat DOUBLE PRECISION,
  delivery_lng DOUBLE PRECISION,
  delivery_location GEOGRAPHY(POINT,4326),
  note TEXT,
  total_amount INTEGER NOT NULL DEFAULT 0,   -- VND, snapshot
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
order_items(
  id BIGSERIAL PK,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id BIGINT REFERENCES menu_items(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL, price_snapshot INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
)
order_events(            -- append-only: audit + feed realtime
  id BIGSERIAL PK,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL, actor_id BIGINT REFERENCES users(id), note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
-- index: orders(buyer_id); orders(restaurant_id, status); order_events(order_id, created_at)
```

## 2) Lib backend (thuần + repo + authz + validate)
### `src/lib/orders/state.ts` (+ `state.test.ts`) — nguồn sự thật transition
- `ORDER_TRANSITIONS`: map trạng thái → kế hợp lệ, **phân nhánh theo `fulfillment_type`**
  (`accepted→delivering` delivery, `accepted→ready` pickup).
- `canTransition(fulfillment, from, to): boolean`.
- `allowedActors(to): Set<'buyer'|'seller'>` — seller: accepted/rejected/delivering/arrived/ready;
  buyer: cancelled; **completed: cả hai**.
- Thuần, không DB → unit test không cần DB (§6).

### `src/lib/orders/authz.ts` — tái dùng `restaurant_owners`/`canEdit`
- `isSellerOf(user, restaurantId)` (gọi `canEdit` ở `src/lib/authz.ts`).
- `canViewOrder(user, order)` — buyer của đơn / seller của quán / admin.
- `assertCanAct(user, order, toStatus)` — `canTransition` + actor khớp `allowedActors`, ném `AuthzError`.

### `src/lib/orders/repo.ts` (mọi SQL tham số hoá `$1,$2…`, MUST §3)
- `createOrder(buyerId, input)` — `withTransaction`: **lấy giá hiện tại từ `menu_items` server-side**
  (không tin giá client), kiểm món thuộc đúng quán + `is_available` → INSERT orders+items+event
  (`pending`) → `pg_notify`.
- `getOrderFull(id)`, `listOrdersForBuyer(buyerId)`, `listOrdersForSeller(user, restaurantId?)`,
  `pendingCountForSeller(user)` (cho badge side menu).
- `advanceStatus(order, toStatus, actorId, note)` — `withTransaction`: UPDATE status+updated_at +
  INSERT order_events + `pg_notify` (cùng transaction → NOTIFY chỉ gửi khi COMMIT).
- **Map DB → kiểu `Order` sẵn có** (`toOrder(row)`): bigint→string id, `name_snapshot`→`name`,
  join `restaurants.name`→`restaurantName`, `created_at`→ISO `createdAt`. Bổ sung `restaurantId` vào
  `types.ts` (additive) để seller lọc theo quán bằng id thay vì tên.
- Payload notify mỏng: `{orderId, status, buyerId, restaurantId}`.

### `src/lib/orderValidate.ts` (validate-at-the-edge, §3)
- `items` (mảng, mỗi món có id + quantity>0), `phone` VN, `fulfillment`; delivery **bắt buộc**
  address+lat+lng, pickup thì cấm. Tái dùng pattern `src/lib/adminValidate.ts`.

## 3) Realtime bus — `src/lib/realtime/bus.ts` (singleton trong process)
- Giữ **1 client pg riêng** (`pool.connect()` giữ mở) chạy `LISTEN order_channel`, reconnect +
  re-LISTEN khi rớt; pattern `globalThis` như `db.ts` để sống qua hot-reload.
- Registry `Map<userId, Set<subscriber>>`; `subscribe(userId, cb) → unsubscribe`.
- Nhận NOTIFY → tính user quan tâm (`buyerId` + seller user của `restaurantId` qua
  `restaurant_owners`) → gọi `cb`.
- **Scale:** mỗi instance giữ 1 kết nối LISTEN riêng tới cùng Postgres → nhiều instance vẫn fan-out
  đúng, không cần Redis. Ngưỡng nâng cấp: NOTIFY throughput thành bottleneck → đổi fan-out sang Redis.

## 4) API routes (`runtime = "nodejs"`; validate-at-the-edge; `getCurrentUser()`)
| Route | Method | Việc |
| --- | --- | --- |
| `app/src/app/api/orders/route.ts` | POST / GET | tạo đơn / list đơn của buyer hiện tại |
| `app/src/app/api/orders/[id]/route.ts` | GET | chi tiết + items + events (`canViewOrder`) |
| `app/src/app/api/orders/[id]/status/route.ts` | PATCH | advance (`assertCanAct`) |
| `app/src/app/api/orders/stream/route.ts` | GET | **SSE** `text/event-stream`, `bus.subscribe(user.id)` |
| `app/src/app/api/seller/orders/route.ts` | GET | list đơn của quán seller quản lý (lọc `restaurant`) |

- SSE: `ReadableStream`, header `text/event-stream` + `no-cache`; heartbeat `: ping\n\n` ~25s;
  cleanup qua `request.signal` abort. **Read-before-write** `route.md` (Next 16) cho streaming.

## 5) Wiring mock → thật (thay nguồn dữ liệu, GIỮ presentational component)
- `src/lib/useOrderStream.ts` (`"use client"`) **mới**: `EventSource('/api/orders/stream')` (tự
  reconnect), `onmessage` → callback refetch.
- **Buyer đặt món:** `OrderForm` submit → `POST /api/orders` (thay mock/sessionStorage) → điều hướng
  `/orders/[id]`.
- **`/orders/[id]`:** page server `fetch GET /api/orders/[id]`; `OrderTracker` nhận `Order` thật +
  `useOrderStream` refetch; **bỏ dev stepper + `simulateAdvance`**. Nút buyer (Huỷ/Đã nhận hàng) gọi
  `PATCH …/status`.
- **`/orders`:** thay `listMockOrders()` bằng `GET /api/orders` của buyer; vẫn `groupOrders`.
- **`/admin/orders`:** thay `listMockOrders()` bằng `GET /api/seller/orders` (lọc theo quán seller);
  vẫn `groupSellerOrders`; dropdown lọc lấy từ quán seller `canEdit`.
- **`/admin/orders/[id]`:** `SellerActionPanel` gọi `PATCH …/status` (thay `simulateAdvance`/
  `simulateReject`) + `useOrderStream`.
- **Badge side menu:** thay đếm mock bằng `GET /api/seller/orders?status=pending` count (hoặc field
  count gọn). Cập nhật khi có event.
- **Gỡ** `src/lib/orders/mock.ts` sau khi mọi nơi đã chuyển; đảm bảo không còn import.

## Bảng file đụng tới
| File | Loại |
| --- | --- |
| `db/init/11_orders.sql` | mới (schema) |
| `app/src/lib/orders/state.ts` (+`.test.ts`) | mới (logic thuần) |
| `app/src/lib/orders/authz.ts`, `repo.ts` (+`repo.test.ts`) | mới |
| `app/src/lib/orderValidate.ts` | mới (validate) |
| `app/src/lib/realtime/bus.ts` | mới (realtime) |
| `app/src/lib/useOrderStream.ts` | mới (client hook) |
| `app/src/app/api/orders/{route,[id]/route,[id]/status/route,stream/route}.ts`, `api/seller/orders/route.ts` | mới (API) |
| `app/src/lib/orders/types.ts` | sửa (thêm `restaurantId`) |
| `OrderForm`, `OrderTracker`, `SellerActionPanel`, `/orders`, `/admin/orders` (+`/[id]`), `AuthButton` | sửa (đổi nguồn dữ liệu) |
| `app/src/lib/orders/mock.ts` | **xoá** sau wiring |

## Test & guardrails
- **Unit (không DB):** `state.test.ts` — mọi transition hợp lệ/không + đúng actor cho delivery &
  pickup (gồm `completed` cả hai actor). Cập nhật `sellerActions.test.ts` nếu cho derive từ `state.ts`.
- **Integration (Postgres thật, §6):** `repo.test.ts` — create → advance qua trạng thái → kiểm
  `orders.status` + chuỗi `order_events`; transition sai bị chặn; user lạ bị 403; pickup không cho
  `delivering`; giá lấy server-side (sửa giá client không ảnh hưởng).
- **Realtime thủ công (2 cửa sổ):** A đặt → B (seller) thấy đơn pending không reload; B advance → A
  đổi tức thì; A ngắt mạng vài giây rồi nối lại → trạng thái đúng (bù lỡ).
- **Trước PR:** `pnpm lint && pnpm test && pnpm build` xanh (từ `app/`).

## Mở rộng ngoài scope (không làm ở MVP)
- Giỏ hàng đa-quán; timeout tự huỷ đơn `pending`; Web Push khi tab đóng; cổng thanh toán online;
  theo dõi vị trí shipper realtime trên bản đồ; đánh giá sau đơn; âm thanh báo đơn mới cho seller.
