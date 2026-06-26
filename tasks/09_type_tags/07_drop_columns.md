# 07 — DB phase 2: DROP cột food/drink

## Vì sao
Sau khi code (task 02–06) đã ngừng đọc/ghi `serves_*`/`kind`, dọn cột chết. Tách riêng bước này
theo AGENTS §4 (DROP qua 2 bước) — chỉ chạy khi code mới đã chạy ổn.

## Việc
- Tạo `db/init/10_drop_food_drink_cols.sql`:
  - `DROP INDEX IF EXISTS restaurants_serves_idx;`
  - `ALTER TABLE restaurants DROP COLUMN IF EXISTS serves_food, DROP COLUMN IF EXISTS serves_drink;`
  - `DROP INDEX IF EXISTS menu_categories_kind_idx;`
  - `ALTER TABLE menu_categories DROP COLUMN IF EXISTS kind;` (CHECK đi kèm cột tự mất).
- **Không** sửa `01_schema.sql`.

## Done khi
- File chạy được trên DB dev (sau khi task 01–06 merged & verify thực tế trên app).
- `\d restaurants` và `\d menu_categories` không còn cột tương ứng; app vẫn chạy (search + admin).
- Ghi rõ trong PR/commit: bước này phải apply SAU khi deploy code mới.
