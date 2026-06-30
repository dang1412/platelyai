# 03 — UI: `OwnerManager` (list + add + remove)

## Vì sao

Admin cần thấy list owner hiện tại và gỡ được, ngay tại trang sửa quán.

## Việc

File mới `app/src/components/admin/OwnerManager.tsx` (`"use client"`):
- Props `{ restaurantId: number; owners: Owner[] }` (import `Owner` từ `@/lib/owners`).
- Render list owner: mỗi dòng `name ?? email` + email phụ + nút "Gỡ" (busy state khi xoá).
  Empty state: "Chưa có chủ quán".
- Form thêm theo email — tái dùng UI/logic của `OwnerForm.tsx` hiện tại (input email + nút "Gán chủ quán").
- Mutation qua `adminFetch`:
  - add: `POST /api/admin/restaurants/${restaurantId}/owners {email}`.
  - remove: `DELETE /api/admin/restaurants/${restaurantId}/owners {userId}`.
  - Sau mỗi mutation thành công: `router.refresh()` (`next/navigation`) để RSC tải lại list;
    không tự quản state list trong client.
- Style bám neighbor admin (`border-black/15`, `text-red-600`…); chạy light + dark như form khác.

Sửa `app/src/app/admin/restaurants/[id]/page.tsx`:
- Import `listRestaurantOwners` + `OwnerManager`; bỏ import `OwnerForm`.
- Trong nhánh `user.role === "admin"`, server-load `const owners = await listRestaurantOwners(data.id)`
  và render `<OwnerManager restaurantId={data.id} owners={owners} />` thay `<OwnerForm/>`.

Xoá `app/src/components/admin/OwnerForm.tsx`.

## Done khi

- Mở `/admin/restaurants/[id]` (admin) thấy list owner; thêm owner → list cập nhật; gỡ owner → biến mất.
- Owner thường (không phải admin) không thấy section này (giữ điều kiện `role==='admin'`).
- Không còn reference tới `OwnerForm` trong repo; `pnpm lint` xanh.
