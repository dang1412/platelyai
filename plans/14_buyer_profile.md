# 14 — Trang thông tin người mua (prefill khi đặt món)

## Mục tiêu

Cho buyer lưu sẵn **SĐT + địa chỉ giao (kèm toạ độ)** một lần. Khi mở form đặt món, các
trường này được **điền sẵn** nhưng vẫn **sửa được**. Route màn hình: `/profile`.

## Quyết định mặc định (chỉnh được)

- **Lưu vào bảng `users`** (thêm cột), không tạo bảng riêng — 1 buyer = 1 bộ thông tin mặc
  định, KISS. Nếu sau này cần nhiều địa chỉ → tách bảng `buyer_addresses` (ngoài scope).
- **Lưu cả toạ độ** (`default_lat/lng`) cùng địa chỉ: trang profile tái dùng nút "Kiểm tra địa
  chỉ" (`/api/geocode`) như `OrderForm`. Nhờ vậy prefill mang sẵn toạ độ → form đặt món chạy
  ngay được gate bán kính 1km mà không bắt geocode lại. Nếu địa chỉ chưa geocode thì chỉ điền
  text, buyer bấm "Kiểm tra địa chỉ" trong form như cũ.
- **Tất cả field tuỳ chọn** (buyer có thể lưu mỗi SĐT, hoặc chưa lưu gì). SĐT nếu có phải hợp lệ
  (`^0\d{9}$`).
- **Không đụng `orders`** — `buyer_phone`/`delivery_address` của đơn vẫn snapshot tại lúc đặt;
  profile chỉ là giá trị mặc định để prefill.

## Luồng

```
/profile (client)
  └─ GET  /api/profile   → { phone, address, lat, lng }   (load vào form)
  └─ PUT  /api/profile   ← { phone?, address?, lat?, lng? } (validate-at-edge → upsert users)

Đặt món (RestaurantModal → OrderForm):
  openOrder() → GET /api/profile (1 lần) → truyền `initial` cho <OrderForm>
              → OrderForm khởi tạo state từ initial (phone/address/geo) → buyer sửa tự do
```

Ranh giới: SQL chỉ ở `src/lib/profile/repo.ts` (tham số hoá $1,$2). Geocode dùng `/api/geocode`
sẵn có (không gọi AI mới). Không có gì chạm AI.

## Backend

- **Schema (additive)** — `db/init/12_buyer_profile.sql`: thêm vào `users`:
  `default_phone TEXT`, `default_address TEXT`, `default_lat DOUBLE PRECISION`,
  `default_lng DOUBLE PRECISION`. Không index (đọc theo PK `id`). File tự chạy khi volume trống;
  volume có data thì chạy tay (ghi chú đầu file như `11_orders.sql`).
- **`src/lib/profileValidate.ts`** — `parseBuyerProfile(body): BuyerProfileInput`. Dùng helper
  `optionalText`, `optionalLatLng` từ `adminValidate.ts`. SĐT: optional, nếu có phải khớp regex
  (tách `requirePhone` thành `optionalPhone` cục bộ). lat/lng chỉ nhận khi có address.
- **`src/lib/profile/repo.ts`** — `getBuyerProfile(userId)` (SELECT 4 cột) +
  `upsertBuyerProfile(userId, input)` (UPDATE users SET … WHERE id=$1). Map về kiểu
  `BuyerProfile = { phone, address, lat, lng }` (null khi trống).
- **`src/app/api/profile/route.ts`** (`runtime="nodejs"`): `GET` trả profile của user hiện tại;
  `PUT` validate body rồi upsert. Cả hai yêu cầu `getCurrentUser()` (401 nếu chưa đăng nhập).
  Bắt lỗi qua `authzResponse` + `validationResponse` như `api/orders/route.ts`.

## Frontend

- **`src/app/profile/page.tsx`** (`"use client"`): render `<SiteHeader />` (theo convention
  buyer-facing), form gồm SĐT + địa chỉ + nút "Kiểm tra địa chỉ" (tái dùng pattern geocode trong
  `OrderForm`) + nút Lưu. Load bằng GET /api/profile; lưu bằng PUT. Hiện trạng thái lưu thành
  công/thất bại. Semantic token, chạy light + dark. Nếu file > ~200 LOC, tách phần geocode thành
  hook/dùng chung với OrderForm (cân nhắc, không bắt buộc).
- **`OrderForm.tsx`**: thêm prop optional `initial?: { phone, address, lat, lng }`. Khởi tạo
  `phone`/`address`/`geo` state từ `initial` (geo set khi có đủ lat/lng). Inputs vẫn sửa được.
- **`RestaurantModal.tsx`**: trong `openOrder()` (hoặc khi `ordering` bật) fetch GET /api/profile
  1 lần, lưu state `profile`, truyền `initial={profile}` xuống `<OrderForm>`. Lỗi fetch → bỏ qua
  (form trống như cũ).
- **`AuthButton.tsx`**: thêm `NavLink` "Thông tin của tôi" → `/profile` trong nhóm "Khách đặt".

## Bảng file đụng tới

| File | Việc |
| --- | --- |
| `db/init/12_buyer_profile.sql` | (mới) thêm 4 cột default_* vào `users` |
| `app/src/lib/profileValidate.ts` | (mới) parse + validate input |
| `app/src/lib/profileValidate.test.ts` | (mới) unit test validate |
| `app/src/lib/profile/repo.ts` | (mới) get/upsert profile |
| `app/src/app/api/profile/route.ts` | (mới) GET/PUT |
| `app/src/app/profile/page.tsx` | (mới) UI trang thông tin |
| `app/src/components/OrderForm.tsx` | thêm prop `initial` + khởi tạo state |
| `app/src/components/RestaurantModal.tsx` | fetch profile + truyền `initial` |
| `app/src/components/AuthButton.tsx` | link tới /profile |

## Test & guardrails

- **Unit** (`profileValidate.test.ts`): SĐT sai/đúng/để trống, address+lat/lng thiếu cặp, body
  rỗng → trả input rỗng hợp lệ.
- **Integration** (chạm Postgres thật, nếu thêm `profile/repo.test.ts`): upsert rồi get trả đúng;
  ghi đè giá trị cũ. (Theo §6 — không mock DB.)
- **MUST nhắc lại:** validate-at-edge trước khi chạm DB; SQL tham số hoá $1,$2; không raw hex /
  palette literal trong JSX mới; light + dark.

## Mở rộng ngoài scope

- Nhiều địa chỉ / sổ địa chỉ (`buyer_addresses`).
- Lưu tên người nhận / nhãn địa chỉ ("Nhà", "Cơ quan").
- Đồng bộ ngược: sửa địa chỉ trong form đặt món → hỏi lưu lại vào profile.
