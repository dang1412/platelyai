# Plan 09 — Thay trục food/drink cứng bằng type-tags mềm

## Mục tiêu
Giản lược trục "đồ ăn vs giải khát": xoá `restaurants.serves_food/serves_drink`,
`menu_categories.kind`, và field `ParsedQuery.category`; thay bằng **type-tag** trong bảng `tags`.
Khi extract KHÔNG có tên món cụ thể, Gemini gắn 1 trong **{"quán ăn", "giải khát"}** vào `tags`
→ rank cộng điểm như tag vibe (`rank.ts` W_TAG).

Ngoài ra thêm 2 tag **"tráng miệng", "ăn vặt"** vào bảng `tags` như tag vibe THƯỜNG (chỉ cần tồn
tại trong vocab; Gemini dùng tự do qua cơ chế tags sẵn có) — KHÔNG có rule riêng, KHÔNG backfill.

Lý do: trục food/drink cứng trùng vai trò với hệ `tags` vốn đã có cơ chế rank mềm; gộp lại
giảm số field phải trích + đồng bộ + bớt code lọc cứng ở `candidates.ts`/`dishes.ts`.

## Quyết định mặc định (chỉnh được)
- **Type-tag = rank mềm** (KHÔNG lọc cứng). Ca không-có-món sẽ trả cả quán khác loại nhưng
  tụt hạng — đổi hành vi so với lọc `serves_*` cũ.
- **Backfill** chỉ `quán ăn ← serves_food=true`, `giải khát ← serves_drink=true`.
  "tráng miệng"/"ăn vặt" chỉ INSERT vào `tags` (không backfill `restaurant_tags`, admin gắn sau).
- **DROP cột = 2 bước** (AGENTS §4): Phase 1 ngừng đọc/ghi (task 1–6); Phase 2 `ALTER … DROP`
  ở SQL file riêng (`db/init/10_*.sql`), chỉ chạy sau khi code mới chạy ổn.
- DB init chỉ chạy lúc `docker compose up` trên data dir trống. DB dev đang có dữ liệu →
  chạy SQL mới **thủ công** (theo convention plans cũ).

## Luồng

```
Query ──► extract.ts (Gemini)
            • dishes (giữ AI)
            • tags  ← + type-tag khi dishes rỗng   ◄── thay cho category
            • maxPrice / wantsCheap / location
          │
          ▼
        candidates.ts  (bỏ nhánh serves_*, bỏ filter mc.kind)
          │  dishes.ts (bỏ param category/kind)
          ▼
        rank.ts (KHÔNG đổi — type-tag đi qua queryTags)
```

- **Search server-side**, không thêm client.
- **Admin**: gỡ `serves_*` (form/route/authz) và `kind` (parse/import/validate/UI).

## Backend
- `extract.ts` + `types.ts`: bỏ `category` (RawExtraction, `ParsedQuery`, `parseExtraction`,
  `fallback`, `normalizeCategory`, prompt, `responseSchema`). Prompt: dishes rỗng → chọn 1 trong
  {quán ăn, giải khát} đưa vào `tags`. 2 tag này nằm trong vocab (sau task DB) nên `parseExtraction` validate sẵn.
- `candidates.ts`: bỏ 2 nhánh `serves_food/serves_drink`, bỏ `mc.kind` ở maxPrice `EXISTS` và
  `attachChips`; bỏ param `category` truyền xuống.
- `dishes.ts`: bỏ param `category` + filter `kind` (block lexical `mi.category_id IN (… kind=…)`).
- `rank.ts`: không đổi.
- Type cleanup: bỏ `FoodCategory` (types.ts), `MenuKind` (admin) khi hết tham chiếu.

## Frontend
- `page.tsx`: bỏ badge `parsed.category` (block hiện 🍽/🥤). food/drink hiện qua list `parsed.tags`
  sẵn có. Server-first, không thêm `"use client"`.

## Schema (additive)
- `db/init/09_type_tags.sql` (mới): `INSERT INTO tags(name) VALUES … ON CONFLICT (name) DO NOTHING`
  (`quán ăn`, `giải khát`, `tráng miệng`, `ăn vặt`); backfill `restaurant_tags` từ
  `serves_food`/`serves_drink` (param hoá không cần —
  thuần literal cố định, không có input ngoài).
- `db/init/10_drop_food_drink_cols.sql` (mới, phase 2): `ALTER TABLE restaurants DROP COLUMN
  serves_food, serves_drink` + drop `restaurants_serves_idx`; `ALTER TABLE menu_categories DROP
  COLUMN kind` + drop `menu_categories_kind_idx`. **Không** sửa `01_schema.sql`.

## Bảng file đụng tới
| Nhóm | File |
| --- | --- |
| DB | `db/init/09_type_tags.sql`, `db/init/10_drop_food_drink_cols.sql` (đều mới) |
| Extract | `app/src/lib/extract.ts`, `app/src/lib/types.ts`, `extract.test.ts`, `extractCache.test.ts` |
| Search core | `app/src/lib/candidates.ts`, `app/src/lib/dishes.ts`, `dishes.test.ts`, `dishes.integration.test.ts` |
| UI search | `app/src/app/page.tsx` |
| Admin serves | `app/src/components/admin/InfoForm.tsx`, `api/admin/restaurants/route.ts`, `api/admin/restaurants/[id]/route.ts`, `lib/authz.ts`, `lib/adminRestaurant.ts` |
| Admin kind | `lib/menuParse.ts`, `lib/menuImport.ts`, `lib/adminValidate.ts`, `components/admin/CategoryBlock.tsx`, `components/admin/MenuImport.tsx`, `components/admin/MenuEditor.tsx`, `api/admin/categories/[id]/route.ts`, `api/admin/restaurants/[id]/categories/route.ts`, `menuParse.test.ts` |

## Test & guardrails
- Unit: `extract.test.ts` (bỏ case category, thêm case dishes-rỗng→type-tag), `dishes.test.ts`
  (bỏ test "maxPrice + category lọc kind"), `menuParse.test.ts` (bỏ assert inferKind).
- Integration (Postgres thật): `dishes.integration.test.ts` — bỏ cột `kind` trong `INSERT`.
- SQL chỉ ở file `db/init/*.sql` mới (additive); không nội suy chuỗi.
- Validate-at-the-edge ở admin route giữ nguyên sau khi gỡ `kind`/`serves_*`.

## Mở rộng ngoài scope
- UI admin để gắn 4 type-tag thủ công (đặc biệt "tráng miệng"/"ăn vặt") — pipeline/data sau.
- Heuristic suy "tráng miệng"/"ăn vặt" từ tên menu — chưa làm.
