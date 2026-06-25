# 05 — UI `MenuImport.tsx` + gắn vào trang sửa quán

## Việc
- `src/components/admin/MenuImport.tsx` (`"use client"`):
  - State: `files`, `parsing`, `preview: ParsedMenu | null`, `saving`, `error`.
  - `<input type="file" accept="image/*" multiple>` → POST `multipart/form-data` tới
    `…/menu/parse`. (Dùng `adminFetch` đã hỗ trợ FormData, hoặc fetch thẳng.)
  - Hiện **preview sửa được**: list nhóm → item (tên/giá/mô tả editable, xoá được, đổi `kind`).
    Tái dùng style field/token như `MenuEditor`/`ItemRow` — KHÔNG raw hex/`bg-zinc-*` (AGENTS §5),
    chạy được cả light + dark.
  - "Lưu menu" → POST JSON `…/menu/import` → `router.refresh()` → reset preview.
  - Hiện rõ `itemsInserted`/`itemsUpdated` sau khi lưu.
- `src/app/admin/restaurants/[id]/page.tsx`: gắn `<MenuImport restaurantId={data.id} />`
  trong section "Menu", **trên** `<MenuEditor>` (dạng collapsible "Nhập menu từ ảnh").
- `src/components/admin/adminFetch.ts`: nếu body là `FormData` thì KHÔNG set
  `Content-Type: application/json` (để browser tự set boundary). Nếu sửa rườm rà → để
  `MenuImport` fetch thẳng cho bước parse.

## Done khi
- Upload ảnh → thấy preview → sửa → lưu → menu mới/đã cập nhật hiện trong `MenuEditor`.
- Light + dark đều ổn; `pnpm lint` xanh.
