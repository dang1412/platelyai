# 06 — Admin: gỡ menu_categories.kind

## Vì sao
`kind` (food/drink/other) không còn được search dùng (task 03). Gỡ khỏi parse/import/validate/UI
để ngừng ghi trước khi DROP cột (task 07).

## Việc
- `app/src/lib/menuParse.ts`: bỏ `inferKind`/`DRINK_RE`, bỏ `kind` khỏi output + prompt schema.
- `app/src/lib/menuImport.ts`: bỏ `kind` khỏi `ImportCategory`, câu SELECT/INSERT/UPDATE (≈ 35–50).
- `app/src/lib/adminValidate.ts`: bỏ `optionalKind` (≈ 43–47) + export.
- `app/src/components/admin/CategoryBlock.tsx`, `MenuImport.tsx`, `MenuEditor.tsx`: bỏ state/select `kind`.
- `app/src/app/api/admin/categories/[id]/route.ts` + `api/admin/restaurants/[id]/categories/route.ts` +
  `api/admin/restaurants/[id]/menu/import/route.ts`: bỏ `kind` khỏi validate + câu SQL.
- `app/src/lib/adminRestaurant.ts`: bỏ `kind` khỏi SELECT + type; bỏ type `MenuKind` khi hết tham chiếu.
- Test: `menuParse.test.ts` bỏ assert `inferKind`/`kind` (≈ 24).

## Done khi
- Import + sửa menu qua admin chạy được, không còn select/field kind.
- `pnpm test` + `pnpm build` xanh; không còn tham chiếu `kind`/`MenuKind` trong code app (chỉ cột DB tới task 07).
