# 05 — link "Tạo quán" trong side menu

## Vì sao
Cho user tìm thấy lối tạo quán. Sidebar = side menu trong `AuthButton.tsx`.

## Việc
- Sửa `app/src/components/AuthButton.tsx`, trong `<nav>` phần **"Khách đặt"** (cạnh
  "Đơn của tôi" / "Quán yêu thích" / "Thông tin của tôi"), thêm:
  - `<NavLink href="/restaurants/new" label="Tạo quán" onNavigate={() => setOpen(false)} icon={<Icon>…</Icon>} />`
  - Icon gợi ý: cửa hàng hoặc dấu cộng (dùng component `Icon` sẵn có, path stroke `currentColor`).
  - Hiện cho **mọi user đăng nhập** — không thêm điều kiện role (nav này đã nằm trong nhánh
    render khi `session?.user` tồn tại). Không badge.

## Done khi
- User thường đăng nhập mở side menu → thấy "Tạo quán", bấm vào ra `/restaurants/new`, menu đóng lại.
- Admin/owner cũng thấy link (theo quyết định đã chốt).
