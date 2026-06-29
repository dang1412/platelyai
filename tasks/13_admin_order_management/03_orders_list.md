# 03 — Trang danh sách /admin/orders

## Vì sao
Seller cần một chỗ xem mọi đơn của quán mình, nhóm theo trạng thái để xử lý theo workflow.

## Việc
- `app/src/components/admin/SellerOrderRow.tsx` (presentational thuần): quán + `OrderStatusBadge` +
  SDT + tổng tiền + thời gian tạo; bọc `Link href="/admin/orders/[id]"`. Semantic token.
- `app/src/app/admin/orders/page.tsx` (**server component**):
  - `await searchParams`; lấy `restaurant` (string | undefined), **validate**: chỉ nhận chuỗi, rỗng
    = tất cả; lọc `listMockOrders()` theo `restaurantName` khi có.
  - `groupSellerOrders(filtered)` → render 3 section (**Cần xử lý / Đang làm / Hoàn tất · Huỷ**) với
    `SellerOrderRow`, empty state mỗi cụm (`text-muted-foreground`).
  - `<form method="get">` chọn quán (dropdown các quán distinct) + nút áp dụng — server-first, không
    client JS. Bám bố cục `/admin/page.tsx` (`max-w-3xl`, header).
  - Semantic token; chạy light + dark.
- `app/src/app/admin/page.tsx`: thêm link **"Quản lý đơn"** → `/admin/orders` (đặt cạnh khu header/CTA,
  hiện cho mọi role vào được admin).

## Done khi
- `/admin/orders` hiện 3 cụm đúng mock; lọc theo quán đổi danh sách qua querystring.
- Click 1 đơn sang `/admin/orders/[id]`.
- Link "Quản lý đơn" xuất hiện ở `/admin`.
- Không palette literal/hex mới ở component order; light + dark ổn.
