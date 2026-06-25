# 06 — Admin tạo quán mới (reuse form edit + toạ độ từ thiết bị)

## Mục tiêu

Cho admin tạo một quán mới từ UI admin, **dùng lại form thông tin quán** (`InfoForm`)
cho cả tạo lẫn sửa. Toạ độ (lat/lng) thêm vào form, có nút **lấy tự động từ thiết bị**
(Geolocation API). Tạo xong → chuyển sang trang sửa quán vừa tạo để nhập menu.

- Route màn tạo: `/admin/restaurants/new`
- Nút "+ Tạo quán" trên trang danh sách `/admin` (chỉ hiện với `role = admin`).

## Quyết định mặc định (user có thể chỉnh)

- **Chỉ `admin` được tạo quán.** Owner vẫn chỉ sửa quán mình sở hữu. Khớp với phần
  "Chủ quán" (gán owner) hiện đã admin-only.
- **lat/lng là field trong `InfoForm` dùng chung** cho tạo + sửa. `PATCH` mở rộng để
  nhận lat/lng (additive). Toạ độ là **tuỳ chọn** — tạo quán không bắt buộc có toạ độ.
- Lấy toạ độ **chỉ từ thiết bị** (Geolocation). Geocode từ địa chỉ = ngoài scope.

## Luồng

```
[Admin] /admin ──"+ Tạo quán"──▶ /admin/restaurants/new (page, server: chặn non-admin)
                                   └─ <InfoForm mode="create">  (client)
                                        │  nhập tên/địa chỉ/…/lat/lng
                                        │  [📍 Lấy toạ độ từ thiết bị] → navigator.geolocation
                                        ▼ submit
                                   POST /api/admin/restaurants  (node runtime)
                                        │  validate-at-edge → INSERT (param hoá)
                                        │  set location = ST_SetSRID(ST_MakePoint(lng,lat),4326)
                                        ▼ { id }
                                   router.push(`/admin/restaurants/{id}`)  (sang màn sửa, nhập menu)
```

- **Client:** `InfoForm` (đã `"use client"`), Geolocation chạy ở browser.
- **Server (node):** route handler `POST`/`PATCH`, chạm DB qua `query()`.
- **AI:** không gọi.

## Backend

### Route `POST /api/admin/restaurants` (thêm vào file đã có)

`app/src/app/api/admin/restaurants/route.ts` hiện chỉ có `GET`. Thêm `export async function POST`.

- **Authz (MUST):** lấy `getCurrentUser()`; nếu `!user` → 401; nếu `user.role !== "admin"`
  → `AuthzError(403, …)`. (Không dùng `requireCanEdit` vì chưa có `restaurantId`.)
- **Validate-at-the-edge (MUST):** parse body JSON; `name = requireText(...)`;
  `address/phone/website = optionalText(...)`; `serves_food/serves_drink = optionalBool(...)`;
  `lat/lng` qua helper mới `optionalLatLng` (xem lib). Lat/lng phải **đi cùng nhau** (cả hai
  hoặc cả hai null).
- **SQL (MUST tham số hoá):**
  ```sql
  INSERT INTO restaurants (name, address, phone, website, serves_food, serves_drink, lat, lng, location, source)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
          CASE WHEN $7::float8 IS NULL OR $8::float8 IS NULL THEN NULL
               ELSE ST_SetSRID(ST_MakePoint($8,$7),4326)::geography END,
          'admin')
  RETURNING id
  ```
  Lưu ý PostGIS dùng thứ tự **(lng, lat)** trong `ST_MakePoint`.
- Trả `Response.json({ id }, { status: 201 })`. Bắt lỗi: `authzResponse ?? validationResponse ?? 500`.

### Route `PATCH /api/admin/restaurants/:id` (mở rộng, additive)

`app/src/app/api/admin/restaurants/[id]/route.ts`: thêm `lat/lng` vào validate + `UPDATE`
(set cả `lat`, `lng`, `location`). Nếu body không gửi lat/lng → giữ nguyên (không ghi đè).
Quy ước đơn giản: chỉ cập nhật toạ độ khi **cả hai** field có mặt; trường hợp xoá toạ độ
ngoài scope lần này (ghi rõ trong task).

### Lib validate

`app/src/lib/adminValidate.ts`: thêm `optionalLatLng(lat, lng)` trả `{ lat, lng } | { lat: null, lng: null }`,
ném `ValidationError` nếu: chỉ một trong hai có mặt, lat ∉ [-90,90], lng ∉ [-180,180], hoặc không phải số.
Có `adminValidate.test.ts` cạnh bên (unit, không cần DB).

## Frontend

### `InfoForm` — generalize cho create + edit

`app/src/components/admin/InfoForm.tsx`:
- Đổi props: `mode: "create" | "edit"` + `restaurant?: RestaurantForEdit`.
  Khi `create` không có `restaurant` → khởi tạo state rỗng.
- Thêm state `lat`, `lng` (string trong input, parse khi submit) + nút
  **"📍 Lấy toạ độ từ thiết bị"** gọi `navigator.geolocation.getCurrentPosition`
  → set lat/lng; báo lỗi nếu bị từ chối / không hỗ trợ.
- Submit:
  - `create` → `adminFetch("/api/admin/restaurants", "POST", {...})`, lấy `id`,
    `router.push(/admin/restaurants/${id})`.
  - `edit` → `PATCH` như cũ + gửi kèm lat/lng, `router.refresh()`.
- Giữ style hàng xóm (class `field`, nút `bg-black …`). Chạy light + dark.
  > Note token: file này hiện dùng literal `border-black/15`, `text-red-600`, `bg-black`
  > theo phong cách hàng xóm trong `components/admin/*`. **Bám đúng style hiện có**, không
  > tự ý đổi sang semantic token trong phạm vi task này (sẽ lệch khỏi các form admin khác).

### Trang tạo `app/src/app/admin/restaurants/new/page.tsx`

- Server component: `getCurrentUser()`, nếu `role !== "admin"` → render thông báo thiếu quyền
  (giống nhánh "Không có quyền" ở trang `[id]`), không lộ form.
- Render `<InfoForm mode="create" />` + link "← Danh sách quán".

### Trang `[id]` + danh sách `/admin`

- `app/src/app/admin/restaurants/[id]/page.tsx`: đổi `<InfoForm restaurant={data} />`
  → `<InfoForm mode="edit" restaurant={data} />`.
- `getRestaurantForEdit` + type `RestaurantForEdit`: thêm `lat`, `lng` (để form edit hiển thị
  toạ độ hiện tại).
- `app/src/app/admin/page.tsx`: thêm nút/link "+ Tạo quán" → `/admin/restaurants/new`,
  chỉ render khi `user.role === "admin"`.

## Schema

**Không cần file SQL mới.** Cột `lat`, `lng`, `location GEOGRAPHY(POINT,4326)` và index GIST
đã có sẵn trong `db/init/01_schema.sql`. Chỉ dùng lại.

## Bảng file đụng tới

| File | Việc |
| --- | --- |
| `app/src/lib/adminValidate.ts` | + `optionalLatLng()` |
| `app/src/lib/adminValidate.test.ts` | + unit test cho `optionalLatLng` (file mới) |
| `app/src/lib/adminRestaurant.ts` | + `lat`, `lng` vào `RestaurantForEdit` + SELECT |
| `app/src/app/api/admin/restaurants/route.ts` | + `POST` (admin-only, insert) |
| `app/src/app/api/admin/restaurants/[id]/route.ts` | `PATCH` + lat/lng (additive) |
| `app/src/components/admin/InfoForm.tsx` | generalize create/edit + Geolocation |
| `app/src/app/admin/restaurants/new/page.tsx` | trang tạo (file mới) |
| `app/src/app/admin/restaurants/[id]/page.tsx` | truyền `mode="edit"` |
| `app/src/app/admin/page.tsx` | nút "+ Tạo quán" (admin-only) |

## Test & guardrails

- **Unit (không DB):** `adminValidate.test.ts` — `optionalLatLng` các case: cả hai null,
  hợp lệ, thiếu một, ngoài range, không phải số.
- **Integration (Postgres thật):** test `POST` tạo quán có/không toạ độ → kiểm `location`
  được set đúng (ST_X/ST_Y khớp lng/lat). Đặt cạnh route nếu repo đã có pattern integration,
  hoặc kiểm tay nếu chưa (ghi rõ trong task finalize).
- Trước PR: `pnpm lint && pnpm test && pnpm build` (trong `app/`) phải xanh.

## Mở rộng ngoài scope (không làm lần này)

- Geocode toạ độ từ địa chỉ (server-side) / chọn điểm trên bản đồ.
- Xoá toạ độ đang có (set về null) qua form edit.
- Owner tự tạo quán + tự gán làm chủ.
- Slug / google_place_id khi tạo.
