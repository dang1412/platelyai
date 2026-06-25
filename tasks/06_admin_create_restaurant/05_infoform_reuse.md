# 05 — Generalize InfoForm (create + edit) + Geolocation

## Vì sao
Mục tiêu chính: dùng lại form thông tin quán cho cả tạo và sửa, thêm toạ độ + nút lấy từ thiết bị.

## Việc
- `app/src/components/admin/InfoForm.tsx`:
  - Props mới: `{ mode: "create" | "edit"; restaurant?: RestaurantForEdit }`.
    - `create`: state khởi tạo rỗng (name="", các field "", serves_* = false, lat/lng = "").
    - `edit`: như hiện tại, đọc từ `restaurant` (kèm lat/lng từ task 02).
  - Thêm state `lat`, `lng` (kiểu string cho `<input>`).
  - Nút **"📍 Lấy toạ độ từ thiết bị"**: gọi `navigator.geolocation.getCurrentPosition`,
    set lat/lng từ `coords`; xử lý lỗi (không hỗ trợ / bị từ chối) → hiện message.
    Disable khi đang lấy.
  - Submit:
    - `create` → `adminFetch("/api/admin/restaurants", "POST", { name, address, phone, website, serves_food, serves_drink, lat, lng })`;
      lấy `id` từ kết quả → `router.push(`/admin/restaurants/${id}`)`.
    - `edit` → `PATCH` như cũ + thêm `lat, lng`; `router.refresh()`.
    - Parse lat/lng: chuỗi rỗng → gửi `null`; ngược lại `Number(...)`.
  - Nút submit: label theo mode ("Tạo quán" / "Lưu thông tin").
  - **Style:** bám literal class hàng xóm hiện có trong file (đừng đổi sang semantic token);
    chạy light + dark.

## Done khi
- `InfoForm mode="create"` render form rỗng, tạo quán → chuyển sang `/admin/restaurants/{id}`.
- `InfoForm mode="edit"` hoạt động như cũ + lưu được toạ độ.
- Nút Geolocation điền lat/lng; báo lỗi khi bị từ chối.
- Build/lint xanh.

## Commit
https://github.com/dang1412/platelyai/commit/91e244e
