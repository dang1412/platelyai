# 03 — Search core: bỏ category/kind khỏi candidates + dishes

## Vì sao
Sau khi extract bỏ `category`, các bước lọc theo `serves_*`/`mc.kind` ở tầng candidate không còn
nguồn và không còn cần (food/drink giờ là rank mềm qua tag).

## Việc
- `app/src/lib/candidates.ts`:
  - Bỏ 2 nhánh `where.push("r.serves_food = true")` / `serves_drink` (≈ dòng 173–176).
  - Bỏ `mc.kind` ở maxPrice `EXISTS` (≈ 169–171) và param category truyền vào `assembleDishCandidates`/`attachChips`.
  - `attachChips`: bỏ tham số `category` + điều kiện `mc.kind = …` (≈ 215–228).
  - Bỏ import `FoodCategory` nếu hết dùng.
- `app/src/lib/dishes.ts`:
  - Bỏ param `category` của `resolveDishes` và block lexical filter
    `AND mi.category_id IN (SELECT id FROM menu_categories WHERE kind = …)` (≈ 138–139) + comment chết liên quan.
- Test:
  - `dishes.test.ts`: bỏ test "maxPrice + category → lọc kind" (≈ 91–95); chỉnh các assert SQL còn lại.
  - `dishes.integration.test.ts`: bỏ cột `kind` trong `INSERT INTO menu_categories` (≈ 29).

## Done khi
- `pnpm test` xanh (gồm integration `dishes.integration.test.ts` hit Postgres thật).
- Không còn tham chiếu `serves_food`/`serves_drink`/`mc.kind` trong `app/src/lib/candidates.ts`, `dishes.ts`.
