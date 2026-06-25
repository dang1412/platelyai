# Feature: Admin tạo quán mới (reuse form edit + toạ độ từ thiết bị)

Plan: [`plans/06_admin_create_restaurant.md`](../../plans/06_admin_create_restaurant.md)

Branch đề xuất: `feat/admin-create-restaurant`

## Tóm tắt

Admin tạo quán mới qua UI, dùng lại `InfoForm` cho cả tạo + sửa. Toạ độ lat/lng thêm vào
form, có nút lấy tự động từ thiết bị (Geolocation). Tạo xong → sang trang sửa để nhập menu.

Quyết định đã chốt: **chỉ admin tạo**; **lat/lng vào form dùng chung + PATCH** (additive).

## Checklist (theo thứ tự phụ thuộc)

- [x] `01_validate_latlng.md` — thêm `optionalLatLng()` + unit test
- [x] `02_restaurant_latlng_read.md` — `RestaurantForEdit` + SELECT thêm lat/lng
- [x] `03_post_route.md` — `POST /api/admin/restaurants` (admin-only, insert + location)
- [x] `04_patch_latlng.md` — `PATCH :id` nhận thêm lat/lng (additive)
- [x] `05_infoform_reuse.md` — generalize `InfoForm` create/edit + nút Geolocation
- [x] `06_create_page_and_link.md` — trang `/admin/restaurants/new` + nút "+ Tạo quán"
- [x] `07_finalize.md` — lint/test/build xanh (PR: chờ user)

## MUST nhắc lại (AGENTS.md)

- **Validate-at-the-edge:** route `POST`/`PATCH` validate input trước khi chạm DB.
- **SQL tham số hoá `$1,$2…`** qua `query()`; never nội suy chuỗi. PostGIS dùng (lng, lat).
- **Authz:** tạo quán = admin-only (kiểm `role` trước khi insert).
- **Server-first**, chỉ `"use client"` khi cần (InfoForm đã có).
- **Read-before-write Next 16:** route params là `Promise` (await), không tạo Pool mới.
