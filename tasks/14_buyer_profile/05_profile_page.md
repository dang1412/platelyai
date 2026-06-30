# 05 — Trang /profile (UI)

> Commit: 47b2aca — feat(profile): trang /profile (UI + geocode + save) ✅

## Vì sao

Màn hình để buyer xem/sửa SĐT + địa chỉ mặc định.

## Việc

- Tạo `app/src/app/profile/page.tsx`, `"use client"` (có state + fetch + geocode).
- Render `<SiteHeader />` (convention buyer-facing — đã lưu memory shared-site-header).
- Mount: `GET /api/profile` → đổ vào state `phone`, `address`, `geo` (set geo khi có lat/lng).
- Form:
  - Input SĐT (inputMode numeric, placeholder `0901234567`), báo lỗi định dạng client như OrderForm.
  - Input địa chỉ + nút "Kiểm tra địa chỉ" gọi `/api/geocode?q=` (tái dùng pattern trong
    `OrderForm.tsx`: state `geo/geoErr/checking`, đổi địa chỉ thì reset geo). Hiện link mở Google Maps.
  - Nút **Lưu**: `PUT /api/profile` với `{ phone, address, lat: geo?.lat, lng: geo?.lng }`; hiện
    trạng thái "Đã lưu" / lỗi.
- Style: semantic token (`bg-surface`, `text-foreground`, `border-border`, `text-brand`…), KHÔNG
  raw hex / palette literal; chạy light + dark. Bám class input của OrderForm cho nhất quán.
- Nếu file vượt ~200 LOC vì lặp lại logic geocode: cân nhắc tách hook dùng chung với OrderForm
  (không bắt buộc — chỉ khi giảm trùng lặp rõ ràng).

## Done khi

- Vào `/profile` (đã đăng nhập) thấy dữ liệu đã lưu; sửa + Lưu → reload vẫn còn.
- "Kiểm tra địa chỉ" trả toạ độ và lưu kèm.
- Chạy được light + dark, không lỗi lint token.
