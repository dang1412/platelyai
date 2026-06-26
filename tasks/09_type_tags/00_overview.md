# Feature 09 — Type-tags thay trục food/drink

Plan: [`plans/09_type_tags.md`](../../plans/09_type_tags.md)

Branch đề xuất: `feat/category-to-type-tags`

## Tóm tắt
Xoá trục cứng food/drink (`serves_food`/`serves_drink`, `menu_categories.kind`,
`ParsedQuery.category`), thay bằng type-tag mềm trong bảng `tags`. Extract gắn 1 trong
**{quán ăn, giải khát}** khi không có tên món cụ thể. Thêm 2 tag vibe thường **tráng miệng,
ăn vặt** vào bảng `tags` (chỉ cần tồn tại, không rule riêng).

## Checklist (theo thứ tự phụ thuộc)
- [x] [01_db_type_tags.md](01_db_type_tags.md) — INSERT 4 tag + backfill restaurant_tags
- [x] [02_extract_type_tag.md](02_extract_type_tag.md) — bỏ `category`, prompt gắn type-tag
- [x] [03_search_drop_kind.md](03_search_drop_kind.md) — candidates.ts + dishes.ts bỏ category/kind
- [x] [04_ui_badge.md](04_ui_badge.md) — page.tsx bỏ badge category
- [x] [05_admin_serves.md](05_admin_serves.md) — gỡ serves_food/serves_drink khỏi admin
- [x] [06_admin_kind.md](06_admin_kind.md) — gỡ kind khỏi parse/import/validate/UI
- [x] [07_drop_columns.md](07_drop_columns.md) — DROP cột (phase 2, sau khi 1–6 verified)
- [x] [08_finalize.md](08_finalize.md) — lint/test/build + PR

## MUST nhắc lại (AGENTS)
- SQL chỉ qua `query()`, tham số hoá `$1,$2…`; backfill ở `db/init/*.sql` **mới** (không sửa `01_schema.sql`).
- Validate-at-the-edge ở mọi admin route sau khi gỡ field.
- Integration test chạm **Postgres thật** (test DB), không mock.
- Schema **additive** — DROP cột tách thành phase 2 (task 07).
- Commit: conventional, **không reference AI**. Theo task-commit-link workflow: commit code →
  thêm link commit vào file task → commit docs-link riêng.
