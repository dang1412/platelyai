# 03 — Component presentational (badge, timeline, summary, card)

> Commit: `a28e907` — feat(orders): component presentational badge/timeline/summary/card UI buyer ✅

## Vì sao
Đây là phần để **tinh chỉnh** chính. Giữ component **thuần presentational** (nhận props, không
fetch) để preview với mock và để plan 10 cắm dữ liệu thật không phải sửa.

## Việc
Tất cả ở `app/src/components/`, dùng **semantic token** (task 01), light + dark, format giá
`toLocaleString('vi-VN')` + ` đ` (như `RestaurantModal`):
- `OrderStatusBadge.tsx` — props `{status}`: pill nhãn từ `STATUS_LABEL`; màu theo nhóm
  (đang xử lý → `brand`, hoàn tất → `success`, huỷ/từ chối → `muted-foreground`).
- `OrderStatusTimeline.tsx` — props `{fulfillment, status}`: gọi `timelineSteps`, render dọc các
  bước với chấm done/current/todo (current nổi bật `brand`); phân nhánh delivery/pickup tự nhiên
  vì step list đã khác nhau.
- `OrderSummary.tsx` — props `{items, total, fulfillment, address?, phone}`: danh sách món × SL,
  tổng tiền, kiểu nhận hàng (giao tới địa chỉ / lấy tại quầy), SDT.
- `OrderCard.tsx` — props `{order, onClick?}`: tóm tắt 1 đơn (tên quán + badge + tổng + thời gian)
  cho danh sách; tái dùng `OrderStatusBadge`.
- Không `"use client"` nếu chỉ render từ props (server component được); thêm chỉ khi cần handler.

## Done khi
- Render thử từng component với mock ở cả light + dark trông hợp lý, không dùng `bg-zinc-*`/hex mới.
- Timeline hiển thị đúng bước hiện tại cho delivery & pickup; badge đổi màu đúng nhóm trạng thái.
- `pnpm lint` xanh; mỗi file gọn (≤~150 LOC), tách theo concern.
