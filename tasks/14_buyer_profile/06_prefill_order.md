# 06 — Prefill form đặt món + nav link

> Commit: 4ba5e82 — feat(profile): prefill OrderForm + RestaurantModal fetch + nav link ✅

## Vì sao

Mục tiêu chính của feature: khi đặt món, SĐT/địa chỉ đã lưu được điền sẵn (vẫn sửa được).

## Việc

- **`app/src/components/OrderForm.tsx`**:
  - Thêm prop optional `initial?: { phone: string | null; address: string | null; lat: number | null; lng: number | null }`.
  - Khởi tạo state từ `initial`: `phone` ← `initial?.phone ?? ""`, `address` ← `initial?.address ?? ""`.
  - `geo`: nếu `initial` có cả lat/lng → khởi tạo `{ lat, lng }` để gate bán kính chạy ngay
    (không bắt buộc bấm "Kiểm tra địa chỉ" lại). Nếu chỉ có address (không toạ độ) → để geo null.
  - Inputs vẫn sửa tự do (đang là controlled state — chỉ đổi giá trị khởi tạo).
- **`app/src/components/RestaurantModal.tsx`**:
  - Khi mở đặt món (trong `openOrder()` hoặc effect khi `ordering` bật): `GET /api/profile` 1 lần,
    lưu vào state `profile`. Lỗi → bỏ qua (giữ null → form trống).
  - Truyền `initial={profile}` xuống `<OrderForm>`.
- **`app/src/components/AuthButton.tsx`**:
  - Thêm `<NavLink href="/profile" label="Thông tin của tôi" .../>` trong nhóm "Khách đặt"
    (cạnh "Đơn của tôi"), kèm icon `<Icon>` phù hợp (vd user/contact).

## Done khi

- Mở form đặt món khi đã lưu profile → SĐT + địa chỉ điền sẵn; nếu có toạ độ thì gate bán kính
  hiển thị ngay, vẫn sửa được.
- Chưa lưu gì → form trống như cũ (không vỡ).
- Side menu có link "Thông tin của tôi" → `/profile`.
