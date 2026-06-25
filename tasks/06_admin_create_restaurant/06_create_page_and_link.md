# 06 — Trang tạo quán + nút "+ Tạo quán"

## Vì sao
Cần màn cho admin mở form tạo, và lối vào từ danh sách. Phải chặn non-admin ở server.

## Việc
- `app/src/app/admin/restaurants/new/page.tsx` (file mới, server component):
  - `getCurrentUser()`; nếu `role !== "admin"` → render block "Không có quyền" (giống nhánh
    trong `restaurants/[id]/page.tsx`), **không render form**.
  - Render link "← Danh sách quán", tiêu đề "Tạo quán mới", và `<InfoForm mode="create" />`.
  - Bố cục `main` bám theo trang `[id]/page.tsx` (max-w-3xl, p-6…).
- `app/src/app/admin/restaurants/[id]/page.tsx`:
  - Đổi `<InfoForm restaurant={data} />` → `<InfoForm mode="edit" restaurant={data} />`.
- `app/src/app/admin/page.tsx`:
  - Thêm link "+ Tạo quán" → `/admin/restaurants/new`, **chỉ khi `user.role === "admin"`**
    (đặt cạnh header hoặc trên ô search), style bám nút hàng xóm.

## Done khi
- `/admin/restaurants/new`: admin thấy form, non-admin thấy "Không có quyền".
- Nút "+ Tạo quán" chỉ hiện với admin, dẫn đúng route.
- Trang `[id]` vẫn sửa bình thường với `mode="edit"`.

## Commit
https://github.com/dang1412/platelyai/commit/2bf0fbd
