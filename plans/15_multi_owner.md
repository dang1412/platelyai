# 15 — Nhiều chủ quán (multi-owner) + hiển thị list owner

## Mục tiêu

Cho phép một quán có **nhiều chủ quán**, hiển thị **danh sách owner hiện tại** (tên + email)
và cho admin **gỡ owner** ngay tại trang sửa quán `/admin/restaurants/[id]`, section "Chủ quán".

> **Lưu ý quan trọng (đọc trước khi code):** model DB đã sẵn sàng nhiều-nhiều.
> `db/init/03_admin.sql` đã có bảng nối `restaurant_owners (restaurant_id, user_id)` PK kép,
> và `POST /api/admin/restaurants/[id]/owners` đã `INSERT … ON CONFLICT DO NOTHING` nên
> **gán nhiều owner đã chạy được**. Feature này **không đổi schema** — chỉ bổ sung:
> 1. Đọc/hiển thị list owner của một quán.
> 2. Gỡ owner (DELETE) + hạ `role` owner→user nếu user không còn sở hữu quán nào.

## Phạm vi (đã chốt với user)

- Hiển thị list: **chỉ** ở trang sửa quán `/admin/restaurants/[id]` (KHÔNG đụng `/admin` list).
- Gỡ owner: **có** (nút xoá cạnh mỗi owner; chỉ admin).
- Schema: **không thêm file SQL** (đã additive sẵn).

## Luồng

```
/admin/restaurants/[id]  (RSC, chỉ admin thấy section Chủ quán)
   └─ server: listRestaurantOwners(id)  ──DB── restaurant_owners ⋈ users
        └─ <OwnerManager restaurantId owners={...}/>   (client)
              ├─ add:    POST   /api/admin/restaurants/[id]/owners {email}
              └─ remove: DELETE /api/admin/restaurants/[id]/owners {userId}
                    → sau mỗi mutation: router.refresh() để RSC tải lại list
```

Server-first: page (RSC) render list owner; client `OwnerManager` chỉ lo mutation + refresh.
Không cần GET endpoint — list lấy thẳng trong RSC.

## Backend

### lib thuần — `app/src/lib/owners.ts` (mới)

Gom toàn bộ logic owner vào một nơi (testable, route chỉ validate + gọi):

- `type Owner = { id: number; name: string | null; email: string }`
- `listRestaurantOwners(restaurantId): Promise<Owner[]>`
  `SELECT u.id, u.name, u.email FROM restaurant_owners ro JOIN users u ON u.id = ro.user_id
   WHERE ro.restaurant_id = $1 ORDER BY u.email ASC` (tham số hoá).
- `assignRestaurantOwner(restaurantId, email): Promise<...>` — **dời logic từ POST hiện tại**:
  tìm user theo email (404 nếu chưa đăng nhập), `INSERT … ON CONFLICT DO NOTHING`,
  nâng `role` 'user'→'owner'. Ném lỗi rõ ràng (dùng `AuthzError`/`ValidationError` hợp lý,
  hoặc trả mã để route map) để route giữ nguyên response 404/201.
- `removeRestaurantOwner(restaurantId, userId): Promise<void>`
  `DELETE FROM restaurant_owners WHERE restaurant_id=$1 AND user_id=$2`; sau đó **hạ role**:
  `UPDATE users SET role='user' WHERE id=$2 AND role='owner'
     AND NOT EXISTS (SELECT 1 FROM restaurant_owners WHERE user_id=$2)`.
  (Không bao giờ hạ admin.)

### route — `app/src/app/api/admin/restaurants/[id]/owners/route.ts` (sửa)

- `runtime="nodejs"` (giữ). Validate-at-the-edge: `requireIntId(id)`, chỉ `role==='admin'`.
- **POST** (refactor): validate `email` (`requireText`), kiểm quán tồn tại, gọi
  `assignRestaurantOwner` → 201. Giữ nguyên các response lỗi 404 hiện có.
- **DELETE** (mới): body `{ userId }` → `requireIntId(body.userId, "userId")`,
  gọi `removeRestaurantOwner(restaurantId, userId)` → `{ ok: true }`. Idempotent
  (xoá dòng không tồn tại vẫn 200).

## Frontend

### `app/src/components/admin/OwnerManager.tsx` (mới, thay `OwnerForm.tsx`)

`"use client"`. Props: `{ restaurantId: number; owners: Owner[] }`.
- List owner hiện tại: mỗi dòng `name` + `email` + nút "Gỡ" (confirm nhẹ, busy state).
  Empty state: "Chưa có chủ quán".
- Form thêm theo email (tái dùng UI hiện có của `OwnerForm`).
- Mutation qua `adminFetch` (POST/DELETE) → `router.refresh()` (next/navigation) để RSC
  tải lại list; bỏ state `done` thủ công.
- **Style:** bám neighbor admin hiện tại (`border-black/15`, `text-red-600`…). AGENTS ưu tiên
  semantic token nhưng toàn bộ admin đang dùng `black/opacity` + `red/green-600` cho form —
  giữ nhất quán hàng xóm (note "why" trong PR). Chạy được light + dark như các form admin khác.
- Xoá `OwnerForm.tsx` cũ (đã gộp vào OwnerManager).

### `app/src/app/admin/restaurants/[id]/page.tsx` (sửa)

- Trong nhánh `user.role === "admin"`, gọi `listRestaurantOwners(data.id)` (server) và render
  `<OwnerManager restaurantId={data.id} owners={owners} />` thay cho `<OwnerForm/>`.

## Schema

**Không thay đổi.** `restaurant_owners` (03_admin.sql) đã nhiều-nhiều + có index `*_user_idx`.
Không thêm `db/init/NN_*.sql`.

## Bảng file đụng tới

| File | Loại | Việc |
| --- | --- | --- |
| `app/src/lib/owners.ts` | mới | list / assign / remove + hạ role |
| `app/src/lib/owners.test.ts` | mới | integration (Postgres thật): assign→list→remove + hạ role |
| `app/src/app/api/admin/restaurants/[id]/owners/route.ts` | sửa | refactor POST gọi lib + thêm DELETE |
| `app/src/components/admin/OwnerManager.tsx` | mới | list + add + remove (client) |
| `app/src/components/admin/OwnerForm.tsx` | xoá | gộp vào OwnerManager |
| `app/src/app/admin/restaurants/[id]/page.tsx` | sửa | load owners + render OwnerManager |

## Test & guardrails

- **Integration** `owners.test.ts` (Postgres thật, theo §6 AGENTS): seed 2 user + 1 quán →
  `assignRestaurantOwner` 2 lần → `listRestaurantOwners` trả 2 dòng đúng thứ tự →
  `removeRestaurantOwner` → còn 1 dòng + user bị gỡ đã hạ về role 'user' (vì hết quán).
  Kiểm role 'admin' không bị hạ.
- **MUST:** mọi query tham số hoá `$1,$2…` qua `query()`; validate `id`/`userId`/`email` ở edge;
  chỉ `role==='admin'` được gọi POST/DELETE.
- Lint/test/build xanh trước PR.

## Mở rộng ngoài scope (không làm lần này)

- Hiển thị owner/badge ở trang list `/admin` (user đã chọn không làm).
- GET endpoint owners (chưa cần — RSC đọc trực tiếp).
- Phân biệt owner "chính/phụ", lời mời qua email cho user chưa đăng nhập.
