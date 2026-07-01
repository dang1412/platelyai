# 04 — trang `/restaurants/new`

## Vì sao
Trang chứa form tạo quán, chặn user chưa đăng nhập.

## Việc
- File mới `app/src/app/restaurants/new/page.tsx` (server component):
  - Lấy user (`getCurrentUser()` hoặc `auth()`); chưa đăng nhập → `redirect("/login")`.
  - Render `<SiteHeader />` (buyer-facing page render SiteHeader theo convention), tiêu đề
    "Tạo quán mới", ghi chú ngắn "Bạn sẽ là chủ quán này", và `<CreateRestaurantForm />`.
  - Container theo neighbor buyer page (vd `mx-auto max-w-* px-* py-*` như `app/profile/page.tsx`).
  - Semantic token, chạy light + dark.

## Done khi
- Vào `/restaurants/new` khi chưa login → chuyển `/login`.
- Đã login → thấy header + form; layout gọn ở mobile + desktop, light + dark.
