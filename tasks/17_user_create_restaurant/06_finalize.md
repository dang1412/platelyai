# 06 — finalize (lint/test/build + PR)

## Vì sao
Chốt chất lượng trước khi mở PR.

## Việc
- Từ `app/`: `pnpm lint && pnpm test && pnpm build` — phải xanh.
- Kiểm tay:
  - Đăng nhập bằng tài khoản **user thường** → side menu có "Tạo quán".
  - Tạo quán (có + không toạ độ) → tự chuyển sang `/admin/restaurants/:id` nhập menu được
    (không bị chặn quyền — role đã lên owner).
  - Trang `/restaurants/new` đẹp ở **light + dark**; chưa login thì bị đẩy về `/login`.
  - Quán vừa tạo xuất hiện được trong tìm kiếm (source='user', không cần duyệt).
- Mở PR về `main` từ `feat/user-create-restaurant`. Conventional commits, không reference AI.
- (Theo workflow task) sau khi merge: thêm link commit vào các file task tương ứng.

## Done khi
- Lint/test/build xanh, kiểm tay đạt, PR mở.
