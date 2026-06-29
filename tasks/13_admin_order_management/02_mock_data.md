# 02 — Mock data cho seller

## Vì sao
Màn hình seller cần đủ đơn (nhiều quán, có đơn `pending`) để demo 3 cụm + bộ lọc quán, và một cách
mô phỏng "từ chối" đối xứng với `simulateAdvance` đã có.

## Việc
- `app/src/lib/orders/mock.ts`:
  - Thêm vài đơn để mỗi cụm seller có dữ liệu: ít nhất 1–2 đơn `pending`, vài đơn đang làm, vài đơn
    kết thúc; trải trên **≥2 quán** (tái dùng `restaurantName` "Quán Ăn Ngon" / "Cà Phê Góc Phố").
  - `simulateReject(order): Order` — trả bản sao `status='rejected'` + append `events` (mốc
    `new Date().toISOString()`), không mutate input. Đối xứng `simulateAdvance`.
  - (tuỳ) `restaurantNames(orders): string[]` — danh sách quán distinct cho dropdown lọc; nếu nhỏ có
    thể tính thẳng ở page thay vì thêm helper (YAGNI — chọn 1, ghi rõ).

## Done khi
- `listMockOrders()` có đơn ở cả 3 cụm seller và ≥2 quán.
- `simulateReject` hoạt động, có thể thêm test nhỏ (hoặc kiểm gián tiếp qua panel).
- `pnpm test` vẫn xanh.
