# Plan 04 — Trang admin: quản lý quán & menu

> Tiếp [plan 03 (auth)](./03_auth.md). Cho **chủ quán (owner)** quản lý quán mình sở hữu và
> **admin tổng** quản lý mọi quán: danh sách quán (có search lọc tên) → sửa thông tin quán → sửa menu.
> File liên quan: `db/init/`, `app/src/auth.ts`, `app/src/app/admin/`, `app/src/app/api/`,
> `app/src/lib/{db,types}.ts`, `app/src/app/api/restaurants/[id]/route.ts` (tái dùng shape menu).

## Khoảng trống hiện tại

- `restaurants` **chưa có liên kết chủ sở hữu**. Phải thêm trước.
- Guard `admin/layout.tsx` đang chỉ cho `role='admin'` → cần mở cho cả `owner`, và phân quyền theo
  từng quán.
- Chưa có API ghi (toàn bộ API hiện tại là read-only cho search).
- Sửa tên/thêm món làm **`menu_items.embedding` lệch** với search semantic (xem [plan 01_3](./01_3_embed.md)).

## Mô hình quyền sở hữu (nền tảng — làm trước)

Bảng nối **nhiều-nhiều** `restaurant_owners` (1 user có thể nhiều quán; 1 quán có thể nhiều owner):
```sql
CREATE TABLE restaurant_owners (
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id       BIGINT NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, user_id)
);
CREATE INDEX restaurant_owners_user_idx ON restaurant_owners (user_id);
```
File mới `db/init/03_admin.sql`; áp DB thật bằng `psql "$DATABASE_URL" -f db/init/03_admin.sql`
(giống cách migrate ở plan 03).

**Quy tắc quyền** (gom vào `app/src/lib/authz.ts`):
- `role='admin'` → toàn quyền mọi quán (bỏ qua `restaurant_owners`).
- `role='owner'` → chỉ quán có dòng `(restaurant_id, user_id)` khớp.
- `role='user'` → không vào được `/admin`.
- Helper: `getCurrentUser()`, `listEditableRestaurants(user, q)`, `assertCanEdit(user, restaurantId)`
  (throw → 403). Mọi API ghi gọi `assertCanEdit` trước.

**Gán owner cho quán:** giai đoạn này admin gán bằng SQL hoặc 1 ô nhập email đơn giản trên trang
chi tiết quán (POST `/api/admin/restaurants/:id/owners` { email }). UI quản lý owner đầy đủ để sau.

## Cấu trúc trang (App Router, server component + guard)

```
/admin                         → danh sách quán + ô search (lọc tên)
/admin/restaurants/[id]        → sửa thông tin quán + sửa menu (tabs/section)
```
- Sửa `admin/layout.tsx`: cho vào nếu `role ∈ {admin, owner}`; `user` → báo thiếu quyền (như hiện tại).
- `/admin` (server component): gọi `listEditableRestaurants(user, q)` với `q` từ `searchParams`.
  Admin thấy tất cả, owner thấy quán của mình. Ô search là `<form method="get">` (giữ server-side,
  không cần client state) → lọc bằng `name ILIKE '%q%'` (đã có index `restaurants_name_trgm_idx`).
  Mỗi quán link sang trang sửa. Hiện badge "tất cả" cho admin.
- `/admin/restaurants/[id]`: `assertCanEdit` ngay đầu (404/403). Tải chi tiết + menu (tái dùng SQL gom
  category ở `api/restaurants/[id]/route.ts` — cân nhắc tách hàm dùng chung trong `lib/`). Form sửa
  thông tin + khu vực sửa menu (client component vì cần thêm/xoá dòng động).

## API ghi (`app/src/app/api/admin/...`)

Tất cả chạy Node runtime (dùng `pg`), gọi `assertCanEdit` trước khi ghi, set `updated_at = now()`.

| Method + path | Việc |
|---|---|
| `GET /api/admin/restaurants?q=` | List quán sửa được (cho client filter nếu cần; trang chính dùng server) |
| `PATCH /api/admin/restaurants/:id` | Sửa thông tin: name, address, phone, website, serves_food, serves_drink |
| `POST /api/admin/restaurants/:id/categories` | Thêm category (category_name, kind, display_order) |
| `PATCH /api/admin/categories/:id` | Sửa category |
| `DELETE /api/admin/categories/:id` | Xoá category (món con: FK `ON DELETE SET NULL`) |
| `POST /api/admin/restaurants/:id/items` | Thêm món (name, price, description, category_id, is_available) |
| `PATCH /api/admin/items/:id` | Sửa món |
| `DELETE /api/admin/items/:id` | Xoá món |
| `POST /api/admin/restaurants/:id/owners` | (admin) gán owner theo email |

Validate: id là số nguyên; price ≥ 0 hoặc null; `kind ∈ {food,drink,other}`; name không rỗng. SQL
tham số hoá `$1,$2…` (theo `lib/db.ts`).

## Lưu ý embedding (quan trọng — đừng để search lệch)

`menu_items.embedding` và `normalized_name` sinh offline (plan 01_3). Khi **thêm/sửa tên món**:
- Set `embedding = NULL` và cập nhật `normalized_name = lower(unaccent(name))` ngay trong API.
- Search semantic bỏ qua món `embedding IS NULL` (cần kiểm `lib/dishes.ts`/`candidates.ts` xử lý đúng,
  hoặc chấp nhận món mới chỉ ra ở nhánh lexical tới khi re-embed).
- Re-embed bằng script sẵn có theo lô (cron/chạy tay) — **ngoài phạm vi UI giai đoạn này**, ghi chú lại.

## Thứ tự triển khai

1. **Nền tảng:** `db/init/03_admin.sql` (`restaurant_owners`) + `lib/authz.ts` + mở guard cho `owner`.
   Seed vài dòng owner để test.
2. **Danh sách + search:** trang `/admin` server-side, lọc tên, link sang chi tiết.
3. **Sửa thông tin quán:** trang `[id]` + `PATCH /api/admin/restaurants/:id`.
4. **Sửa menu:** category + item CRUD (client component thêm/xoá dòng), kèm xử lý embedding NULL.
5. **Gán owner:** ô nhập email cho admin (tối giản).

## Ngoài phạm vi (giai đoạn sau)

- UI quản lý owner đầy đủ, mời/gỡ owner.
- Re-embed tự động sau khi sửa menu.
- Sửa tag/vibe, ảnh món (upload `image_url`), toạ độ/địa lý.
- Nhận đặt món (giai đoạn tiếp theo của lộ trình ở plan 03).
