# 17 — User thường tự tạo quán (self-serve) + link "Tạo quán" trong sidebar

## Mục tiêu

Cho **bất kỳ user đã đăng nhập** tự tạo một quán mới (không cần admin). User tạo quán
**tự trở thành chủ quán** (owner) của quán đó và được nâng `role` `user`→`owner` để vào khu
quản trị nhập menu. Thêm link **"Tạo quán"** vào side menu (sidebar) cho mọi user đăng nhập.

- Route màn tạo (buyer-facing): `/restaurants/new`
- Link "Tạo quán" trong side menu (`AuthButton.tsx`), phần "Khách đặt".
- Sau khi tạo xong → chuyển sang `/admin/restaurants/:id` để nhập menu (user giờ là owner).

## Quyết định mặc định (đã chốt với user)

- **Ai tạo được:** mọi user đã đăng nhập (kể cả admin/owner). Link hiện cho tất cả user đăng nhập.
- **Không duyệt:** quán tạo xong vào DB ngay như quán admin tạo, `source='user'`, xuất hiện luôn
  trong tìm kiếm. **Không thêm cột schema, không có luồng duyệt.**
- **Sau khi tạo → `/admin/restaurants/:id`** (trang sửa quán, nhập menu). User vừa tạo là owner
  nên vào được — nhưng JWT role cần được làm tươi trước khi điều hướng (xem Frontend §refresh role).
- **Toạ độ tuỳ chọn**, lấy từ thiết bị (Geolocation) như plan 06. Không geocode từ địa chỉ.

## Luồng

```
[User đăng nhập] side menu ──"Tạo quán"──▶ /restaurants/new  (RSC: chưa login → /login)
                                             └─ <CreateRestaurantForm>  (client)
                                                  │ nhập tên/địa chỉ/đt/web + lat/lng
                                                  │ [📍 Lấy toạ độ từ thiết bị]
                                                  ▼ submit
                                             POST /api/restaurants  (node runtime)
                                                  │ authz: chỉ cần đã đăng nhập (401 nếu chưa)
                                                  │ validate-at-edge (reuse adminValidate)
                                                  │ withTransaction:
                                                  │   INSERT restaurants (... source='user') RETURNING id
                                                  │   INSERT restaurant_owners (id, uid) ON CONFLICT DO NOTHING
                                                  │   UPDATE users SET role='owner' WHERE id=uid AND role='user'
                                                  ▼ { id }
                                             update() làm tươi session role → router.push(/admin/restaurants/{id})
```

- **Client:** `CreateRestaurantForm` ("use client"), Geolocation + gọi API + `update()` session.
- **Server (node):** route `POST /api/restaurants`, lib `createOwnedRestaurant` chạm DB (transaction).
- **AI:** không gọi.

## Backend

### lib thuần — `app/src/lib/createRestaurant.ts` (mới)

Gom logic tạo quán + gán owner + nâng role vào **một transaction** (nguyên tử, testable):

```ts
type CreateInput = {
  ownerId: number;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
};
export async function createOwnedRestaurant(input: CreateInput): Promise<{ id: number }>
```

- Dùng `withTransaction` (đã có trong `src/lib/db.ts`) — 3 câu cùng nguyên tử:
  1. `INSERT INTO restaurants (name, address, phone, website, lat, lng, location, source)`
     `VALUES ($1..$6, CASE WHEN $5::float8 IS NULL OR $6::float8 IS NULL THEN NULL`
     `ELSE ST_SetSRID(ST_MakePoint($6,$5),4326)::geography END, 'user') RETURNING id`
     — **giống hệt** POST admin (plan 06) nhưng `source='user'`. Nhớ `ST_MakePoint(lng,lat)`.
  2. `INSERT INTO restaurant_owners (restaurant_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`
  3. `UPDATE users SET role='owner' WHERE id=$1 AND role='user'` (không đụng admin).
- **MUST tham số hoá** mọi câu. Không import `@/lib/authz`/`@/auth` ở đây (giống `owners.ts`:
  vitest không nạp được next-auth) → route lo authz, lib chỉ chạm DB.

> **Không gộp vào `owners.ts`:** `assignRestaurantOwner` nhận `email` + không transaction +
> không insert restaurant. Tạo lib riêng rõ concern hơn (bước 2+3 ở đây trùng ý tưởng nhưng
> thao tác theo `userId` trong cùng transaction với INSERT quán).

### route — `app/src/app/api/restaurants/route.ts` (mới; hiện chỉ có `[id]/`)

- `export const runtime = "nodejs"`.
- **`POST`:**
  - **Authz (MUST):** `getCurrentUser()`; `!user` → `AuthzError(401)`. **Không** kiểm role (mọi
    user đăng nhập tạo được).
  - **Validate-at-edge (MUST):** parse body; **reuse** `requireText(body.name, "Tên quán")`,
    `optionalText`, `optionalLatLng(body.lat, body.lng)` từ `@/lib/adminValidate`.
  - Gọi `createOwnedRestaurant({ ownerId: user.id, ... })` → `Response.json({ id }, {status:201})`.
  - Bắt lỗi: `authzResponse(err) ?? validationResponse(err) ?? 500`.

## Frontend

### `app/src/components/admin/InfoForm.tsx` (generalize — dùng CHUNG cho admin + user)

Thay vì tạo form riêng, **dùng chung `InfoForm`** cho cả 3 luồng (quyết định của user: gộp 1 form).
Thêm mode thứ ba `"create-self"`:
- Props: `{ mode: "create" | "create-self"; restaurant?: undefined } | { mode: "edit"; restaurant }`.
- `onSubmit` phân nhánh: `edit` → PATCH + refresh; `create` → POST `/api/admin/restaurants`;
  `create-self` → POST `/api/restaurants`.
- **Refresh role (quan trọng, chỉ `create-self`):** sau khi tạo, user vừa được nâng `owner` trong DB
  nhưng JWT còn role cũ. Gọi `useSession().update()` **trước** `router.push(/admin/restaurants/${id})`
  để jwt callback refetch role (`auth.ts` làm tươi role theo `token.uid` mỗi lần decode) → không bị
  `admin/layout.tsx` chặn. (`SessionProvider` bọc toàn app nên `useSession` gọi được cả trong /admin.)
- Nút **"📍 Lấy toạ độ từ thiết bị"** giữ nguyên (Geolocation, `enableHighAccuracy`).
- **Chuyển style sang semantic token (MUST §5):** vì form giờ render ở trang buyer-facing
  `/restaurants/new`, đổi `border-black/15`→`border-border`, `bg-black`→`bg-brand`,
  `text-red-600`→`text-danger`, `text-green-600`→`text-muted-foreground`, thêm `bg-surface`/
  `text-foreground` cho input. Chạy light + dark (tốt hơn cho dark so với `black/opacity` cũ).

> **Vì sao gộp thay vì form riêng:** ba luồng chỉ khác endpoint + (create-self thêm `update()`).
> Gộp tránh trùng field + geolocation; đổi InfoForm sang token cũng đúng §5 hơn cho khu admin.

### `app/src/app/restaurants/new/page.tsx` (mới)

- Server component. `getCurrentUser()`; chưa đăng nhập → `redirect("/login")`.
- Render `<SiteHeader />` (buyer-facing page phải render SiteHeader — theo convention), tiêu đề
  "Tạo quán mới", `<InfoForm mode="create-self" />`, và ghi chú ngắn "Bạn sẽ là chủ quán này".
- Container theo neighbor buyer page (vd `max-w-*` + padding như `profile/page.tsx`).

### `app/src/components/AuthButton.tsx` (sửa — thêm link sidebar)

- Trong `<nav>`, phần **"Khách đặt"**, thêm một `<NavLink href="/restaurants/new" label="Tạo quán" …>`
  với icon (vd cửa hàng/plus). Hiện cho **mọi user đăng nhập** (đặt trong nhánh đã render khi
  `session?.user` tồn tại — cả nav đang nằm trong return đó). Không cần điều kiện role.
- `onNavigate={() => setOpen(false)}` như các NavLink khác. Không badge.

## Schema

**Không cần file SQL mới.** Cột `name/address/phone/website/lat/lng/location/source` của
`restaurants` và bảng `restaurant_owners` đã có sẵn (`01_schema.sql`, `03_admin.sql`). Chỉ dùng lại.

## Bảng file đụng tới

| File | Loại | Việc |
| --- | --- | --- |
| `app/src/lib/createRestaurant.ts` | mới | `createOwnedRestaurant()` (transaction: insert quán + owner + nâng role) |
| `app/src/lib/createRestaurant.test.ts` | mới | integration (Postgres thật): tạo → có quán source='user' + owner + role owner |
| `app/src/app/api/restaurants/route.ts` | mới | `POST` self-serve (401 nếu chưa login, validate, gọi lib) |
| `app/src/components/admin/InfoForm.tsx` | sửa | + mode `create-self` (dùng chung) + update() session + semantic token |
| `app/src/app/restaurants/new/page.tsx` | mới | trang tạo (redirect nếu chưa login) + SiteHeader + `<InfoForm mode="create-self"/>` |
| `app/src/components/AuthButton.tsx` | sửa | thêm NavLink "Tạo quán" vào side menu |

## Test & guardrails

- **Integration (Postgres thật, §6 AGENTS)** `createRestaurant.test.ts`: seed 1 user role='user'
  → `createOwnedRestaurant({ownerId, name, lat, lng})` → kiểm:
  - quán mới tồn tại, `source='user'`, `ST_X(location)=lng` & `ST_Y(location)=lat` khi có toạ độ;
  - có dòng `restaurant_owners (id, ownerId)`;
  - user đã được nâng `role='owner'`;
  - case không toạ độ → `location IS NULL`.
- **Validate** đã reuse `adminValidate` (đã có unit test `adminValidate.test.ts` — không cần thêm).
- **MUST:** SQL tham số hoá qua `query()/withTransaction`; validate ở edge; route chặn 401 khi
  chưa đăng nhập.
- Trước PR: `pnpm lint && pnpm test && pnpm build` (trong `app/`) xanh. Kiểm tay: light + dark trang
  `/restaurants/new`; tạo bằng tài khoản user thường → vào được trang sửa quán nhập menu.

## Mở rộng ngoài scope (không làm lần này)

- Duyệt/kiểm duyệt quán do user tạo (status pending/approved) + ẩn khỏi search.
- Giới hạn số quán mỗi user / chống spam / rate limit.
- Geocode toạ độ từ địa chỉ, chọn điểm trên bản đồ.
- Trang "Quán của tôi" liệt kê quán user sở hữu (hiện đã vào được qua `/admin`).
