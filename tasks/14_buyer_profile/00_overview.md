# Feature 14 — Trang thông tin người mua (prefill khi đặt món)

Plan: [`plans/14_buyer_profile.md`](../../plans/14_buyer_profile.md)

Cho buyer lưu sẵn SĐT + địa chỉ (kèm toạ độ) ở `/profile`; khi mở form đặt món các trường được
điền sẵn và vẫn sửa được.

## Branch đề xuất

`feat/buyer-profile`

## Checklist (theo thứ tự phụ thuộc)

- [ ] `01_schema.md` — thêm cột `default_*` vào `users` (`db/init/12_buyer_profile.sql`)
- [ ] `02_validate.md` — `profileValidate.ts` + unit test
- [ ] `03_repo.md` — `profile/repo.ts` (get/upsert)
- [ ] `04_api.md` — `api/profile/route.ts` (GET/PUT)
- [ ] `05_profile_page.md` — trang `/profile` (UI + geocode + save)
- [ ] `06_prefill_order.md` — `OrderForm` prop `initial` + `RestaurantModal` fetch + nav link
- [ ] `07_finalize.md` — lint/test/build + PR

## MUST nhắc lại (AGENTS §3, §9)

- **Validate-at-the-edge**: GET/PUT validate input TRƯỚC khi chạm DB.
- **SQL tham số hoá `$1,$2…`** qua `query()`/`withTransaction` — không nội suy chuỗi.
- **Server-first**; chỉ `"use client"` khi cần state/effect.
- **Không raw hex / `bg-zinc-*` ngoài-token / `[13px]`** trong JSX mới — dùng semantic token; mọi
  screen mới chạy được light + dark.
- File ≤200 LOC mục tiêu, tách theo concern khi vượt 300.
- Mỗi task xong: commit code → thêm link commit vào file task → commit docs-link riêng
  (theo workflow đã lưu).
