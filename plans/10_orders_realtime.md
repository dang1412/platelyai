# 10 — Đặt món + theo dõi trạng thái realtime (giao hàng / lấy tại quầy)

## Mục tiêu
Cho **buyer** (`role='user'`) đặt món từ một quán, chọn **giao hàng** hoặc **lấy tại quầy**,
nhập SDT; **seller** (`role='owner'` của quán) nhận đơn và đẩy trạng thái; cả hai thấy cập
nhật **realtime** không cần reload.

- Buyer: trang theo dõi đơn `/orders/[id]`; nút "Đặt món" trên trang/modal quán.
- Seller: dashboard `/seller/orders`.

## Quyết định mặc định (chỉnh được)
- **1 đơn = 1 quán** (không giỏ hàng đa-quán).
- **Buyer bắt buộc đăng nhập** (Google như hiện tại); SDT chỉ là thông tin liên hệ giao hàng.
- **Thanh toán tiền mặt khi nhận/lấy hàng** — MVP không tích hợp cổng thanh toán.
- **Realtime = SSE + Postgres LISTEN/NOTIFY** (deploy server Node chạy liên tục). DB là nguồn
  sự thật; realtime chỉ đẩy tín hiệu mỏng → client **refetch**. Không thêm Redis/dịch vụ ngoài.

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

- **Chạm DB:** mọi route qua `query()`/`withTransaction()` (`src/lib/db.ts`). **Không AI** trong feature này.
- **Realtime push** chỉ khi tab mở (SSE). Reconnect → refetch để bù event lỡ.

## Backend

### Schema — `db/init/11_orders.sql` (additive, KHÔNG sửa file đã apply, §4)
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

### Lib thuần — `src/lib/orders/state.ts` (+ `state.test.ts` cạnh bên)
- `ORDER_TRANSITIONS`: map trạng thái → kế hợp lệ, **phân nhánh theo `fulfillment_type`**
  (`accepted → delivering` cho delivery, `accepted → ready` cho pickup).
- `canTransition(fulfillment, from, to): boolean`.
- `actorFor(to): 'buyer' | 'seller'` (seller: accepted/rejected/delivering/arrived/ready;
  buyer: cancelled/completed).
- Thuần, không chạm DB → unit test không cần DB (§6).

### Authz — `src/lib/orders/authz.ts` (tái dùng pattern `restaurant_owners`)
- `isSellerOf(user, restaurantId)` — gọi lại `canEdit` ở `src/lib/authz.ts`.
- `canViewOrder(user, order)` — buyer của đơn / seller của quán / admin.
- `assertCanAct(user, order, toStatus)` — `canTransition` + actor khớp `user`, ném `AuthzError`.

### Repo — `src/lib/orders/repo.ts` (mọi SQL tham số hoá `$1,$2…`, MUST §3)
- `createOrder(buyerId, input)` — `withTransaction`: **lấy giá hiện tại từ `menu_items` server-side**
  (không tin giá client), kiểm món thuộc đúng quán + `is_available` → INSERT orders+items+event
  (`pending`) → `pg_notify`.
- `getOrderFull(id)`, `listOrdersForBuyer(buyerId)`, `listActiveOrdersForSeller(user)`.
- `advanceStatus(order, toStatus, actorId, note)` — `withTransaction`: UPDATE status+updated_at
  + INSERT order_events + `pg_notify` (cùng transaction → NOTIFY chỉ gửi khi COMMIT).
- Payload notify mỏng: `{orderId, status, buyerId, restaurantId}`.

### Realtime bus — `src/lib/realtime/bus.ts` (singleton trong process)
- Giữ **1 client pg riêng** (`pool.connect()` giữ mở) chạy `LISTEN order_channel`, có reconnect +
  re-LISTEN khi rớt; pattern `globalThis` như `db.ts` để sống qua hot-reload.
- Registry `Map<userId, Set<subscriber>>`; `subscribe(userId, cb) → unsubscribe`.
- Nhận NOTIFY → tính user quan tâm (`buyerId` + seller user của `restaurantId` qua
  `restaurant_owners`) → gọi `cb`.
- **Scale:** 1 instance giữ hàng chục nghìn SSE idle; nhiều instance vẫn fan-out đúng vì mỗi
  instance có 1 kết nối LISTEN riêng tới cùng Postgres (không cần Redis). Ngưỡng nâng cấp: khi
  NOTIFY throughput thành bottleneck → đổi fan-out trong file này sang Redis/managed.

### API routes (`runtime = "nodejs"`; validate-at-the-edge; `getCurrentUser()`)
| Route | Method | Việc |
| --- | --- | --- |
| `app/src/app/api/orders/route.ts` | POST/GET | tạo đơn / list đơn của tôi |
| `app/src/app/api/orders/[id]/route.ts` | GET | chi tiết + items + events (`canViewOrder`) |
| `app/src/app/api/orders/[id]/status/route.ts` | PATCH | advance (`assertCanAct`) |
| `app/src/app/api/orders/stream/route.ts` | GET | **SSE** `text/event-stream`, `bus.subscribe(user.id)` |

- SSE: `ReadableStream`, header `text/event-stream` + `no-cache`; heartbeat `: ping\n\n` ~25s;
  cleanup qua `request.signal` abort. **Read-before-write** `route.md` (Next 16) cho streaming.
- Validate: tái dùng `src/lib/adminValidate.ts`; thêm `src/lib/orderValidate.ts` (mảng items,
  quantity>0, phone VN, delivery bắt buộc lat/lng/address; pickup thì không).

## Frontend (server-first; `"use client"` chỉ khi cần; semantic token, light+dark, §5)
- Hook `src/lib/useOrderStream.ts` (`"use client"`): `EventSource('/api/orders/stream')`
  (tự reconnect), `onmessage`/`onopen` → callback refetch.
- `src/components/OrderStatusTimeline.tsx`, `OrderCard.tsx` (dùng chung).
- Buyer: form đặt món (chọn delivery/pickup; delivery dùng `useGeolocation` sẵn có) trên
  `RestaurantModal`/trang quán → `POST` → chuyển `/orders/[id]`; trang `/orders/[id]/page.tsx`
  hiện timeline + badge "Shipper đã tới"/"Sẵn sàng lấy".
- Seller: `/seller/orders/page.tsx` list đơn hoạt động + nút advance theo state machine.

## Bảng file đụng tới
| File | Loại |
| --- | --- |
| `db/init/11_orders.sql` | mới (schema) |
| `app/src/lib/orders/state.ts` (+`.test.ts`) | mới (logic thuần) |
| `app/src/lib/orders/authz.ts`, `repo.ts` (+`repo.test.ts`) | mới |
| `app/src/lib/orderValidate.ts` | mới (validate) |
| `app/src/lib/realtime/bus.ts` | mới (realtime) |
| `app/src/lib/useOrderStream.ts` | mới (client hook) |
| `app/src/app/api/orders/{route,[id]/route,[id]/status/route,stream/route}.ts` | mới (API) |
| `app/src/app/orders/[id]/page.tsx`, `app/src/app/seller/orders/page.tsx` | mới (page) |
| `app/src/components/{OrderStatusTimeline,OrderCard}.tsx` | mới (UI) |
| `RestaurantModal`/trang quán | sửa (thêm nút Đặt món) |

## Test & guardrails
- **Unit (không DB):** `state.test.ts` — mọi transition hợp lệ/không + đúng actor cho cả
  delivery & pickup.
- **Integration (Postgres thật, §6):** `repo.test.ts` — create → advance qua trạng thái → kiểm
  `orders.status` + chuỗi `order_events`; transition sai bị chặn; user lạ bị 403; pickup không
  cho `delivering`.
- **Realtime thủ công (2 cửa sổ):** A đặt → B thấy đơn pending không reload; B advance → A đổi
  tức thì; A ngắt mạng vài giây rồi nối lại → hiển thị đúng trạng thái (bù lỡ).
- **Trước PR:** `pnpm lint && pnpm test && pnpm build` xanh (từ `app/`).

## Mở rộng ngoài scope (không làm ở MVP)
- Giỏ hàng đa-quán; timeout tự huỷ đơn `pending`; Web Push khi tab đóng; cổng thanh toán online;
  theo dõi vị trí shipper realtime trên bản đồ; đánh giá sau đơn.
