# 03 — Link "Đơn của tôi" trong side menu

> Commit: d9137e6 — feat(auth): thêm link 'Đơn của tôi' vào side menu khi đã đăng nhập ✅

## Vì sao
User cần lối vào trang lịch sử từ side menu, chỉ khi đã đăng nhập.

## Việc
- `app/src/components/AuthButton.tsx`:
  - Trong `<nav>` (side menu, nhánh đã có `session.user`), thêm
    `<Link href="/orders" onClick={() => setOpen(false)}>Đơn của tôi</Link>`, đặt **trên** link admin.
  - Dùng đúng class link admin sẵn có (`px-4 py-3 transition hover:bg-zinc-100 dark:hover:bg-zinc-800`)
    để đồng nhất — file này đang dùng palette literal cũ, **không** migrate ở task này (giữ nhất quán
    hàng xóm; migrate token là việc riêng ngoài scope).
  - Hiện cho mọi user đã đăng nhập (không điều kiện role).

## Done khi
- Đăng nhập → mở side menu thấy "Đơn của tôi" trên "Trang quản trị"; click sang `/orders` và đóng menu.
- Chưa đăng nhập → không thấy link (vẫn ở nhánh icon đăng nhập).
