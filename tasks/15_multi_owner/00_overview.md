# Feature 15 — Nhiều chủ quán + hiển thị list owner

Plan: [`plans/15_multi_owner.md`](../../plans/15_multi_owner.md)

Branch đề xuất: `feat/multi-owner`

## Bối cảnh (đọc trước)

Model DB **đã nhiều-nhiều** (`restaurant_owners`, xem `db/init/03_admin.sql`) và POST gán owner
đã `ON CONFLICT DO NOTHING` → gán nhiều owner đã chạy. Feature này **không đổi schema**, chỉ thêm
**hiển thị list owner + gỡ owner** tại `/admin/restaurants/[id]` (section "Chủ quán", chỉ admin).

## Checklist (theo thứ tự phụ thuộc)

- [x] `01_owners_lib.md` — `src/lib/owners.ts`: list / assign / remove + hạ role, có integration test
- [x] `02_owners_api.md` — refactor POST gọi lib + thêm DELETE ở `owners/route.ts`
- [x] `03_owner_manager_ui.md` — `OwnerManager.tsx` (list + add + remove) thay `OwnerForm`, wire vào page
- [x] `04_finalize.md` — lint + test + build xanh, mở PR

Code: `6d5971f` (lint + 156 tests + build xanh).

## Nhắc lại MUST (AGENTS.md)

- **SQL:** chỉ qua `query()` trong `src/lib/db.ts`, **luôn `$1,$2…`** — Never nội suy chuỗi.
- **Validate-at-the-edge:** route validate `id`/`userId`/`email` + chặn `role!=='admin'` trước khi chạm DB.
- **Server-first:** page là RSC; chỉ `OwnerManager` cần `"use client"`.
- **Integration test chạm DB phải hit Postgres thật** (test DB), không mock.
- **Token UI:** bám style hàng xóm admin; nếu dùng palette literal (`black/15`, `red-600`) như form
  admin hiện tại thì note "why" (nhất quán neighbor) trong PR.
- **Schema additive:** KHÔNG sửa `db/init/*.sql` đã apply; feature này không thêm file SQL.
