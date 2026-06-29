# 02 — Nâng cấp trang /orders thành 2 nhóm

## Vì sao
`/orders` hiện liệt kê phẳng mọi đơn. Trang lịch sử cần tách **Đang xử lý** / **Lịch sử** để giống
app giao đồ ăn thật.

## Việc
- `app/src/app/orders/page.tsx`:
  - Thêm **header chung** `<SiteHeader />` ở đầu `<main>` (convention buyer-facing — `/orders` đang
    thiếu header; xem `components/SiteHeader.tsx`). Không truyền `subtitle`.
  - Thay `listMockOrders()` phẳng bằng `groupOrders(listMockOrders())`.
  - Render 2 section, mỗi section có tiêu đề (**Đang xử lý**, **Lịch sử**) + danh sách `OrderCard`
    (giữ `onClick → router.push('/orders/${id}')`).
  - **Empty state** mỗi nhóm: luôn hiện tiêu đề + dòng nhẹ khi rỗng (vd "Chưa có đơn đang xử lý"),
    dùng `text-muted-foreground`.
  - Giữ `"use client"` (cần `useRouter`); semantic token; bố cục bám style hiện tại
    (`mx-auto max-w-lg px-5 py-8`). Chạy light + dark.
- Nếu page chạm ~200 LOC → tách 1 component `OrderSection` nhỏ; còn nhỏ thì để trong page (YAGNI).

## Done khi
- `/orders` hiện 2 nhóm đúng dữ liệu mock; click đơn vẫn sang `/orders/[id]`.
- Empty state hiển thị khi nhóm rỗng.
- Không palette literal/hex mới; light + dark đều ổn.
