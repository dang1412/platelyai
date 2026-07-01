# 03 — Form tạo quán dùng chung (generalize `InfoForm`)

## Vì sao
Cần form nhập thông tin quán cho user self-serve. **Dùng chung `InfoForm`** (quyết định của user:
gộp 1 form) thay vì tạo component riêng — tránh trùng field + geolocation, và thống nhất giao diện
với luồng admin. Vì form giờ render ở trang buyer-facing nên chuyển sang semantic token (§5).

## Việc
- Sửa `app/src/components/admin/InfoForm.tsx`:
  - Props thêm mode `create-self`:
    `{ mode: "create" | "create-self"; restaurant?: undefined } | { mode: "edit"; restaurant }`.
  - `onSubmit` phân nhánh: `edit` → PATCH `/api/admin/restaurants/:id` + refresh; `create` →
    POST `/api/admin/restaurants`; `create-self` → POST `/api/restaurants`. Cả hai create đều
    `router.push(/admin/restaurants/${id})`.
  - **create-self:** gọi `useSession().update()` **trước** khi push để role owner có hiệu lực
    (`SessionProvider` bọc toàn app nên gọi được cả trong /admin).
  - Nút "📍 Lấy toạ độ từ thiết bị" giữ nguyên.
  - **Chuyển sang semantic token:** `border-black/15`→`border-border`, `bg-black`→`bg-brand`
    (`text-brand-foreground`, `hover:bg-brand-hover`), `text-red-600`→`text-danger`,
    `text-green-600`→`text-muted-foreground`, input thêm `bg-surface text-foreground`.

## Done khi
- `/restaurants/new` và `/admin/restaurants/new` + trang sửa dùng chung `InfoForm`, không còn
  `CreateRestaurantForm.tsx`.
- Không còn literal `black`/`red-600`/`green-600`; đẹp ở light + dark.
- `pnpm lint` + `tsc --noEmit` xanh; ba mode `create`/`create-self`/`edit` typecheck đúng.
