# Feature: Gộp "category món" thành 1 cột FTS (phraseto + plainto)

Plan: [`plans/07_dish_combined_search.md`](../../plans/07_dish_combined_search.md)

Branch đề xuất: `feat/dish-combined-search`

## Tóm tắt

Thêm cột `search_vec tsvector` vào `menu_items` gộp `category_name + name` ("category món"),
maintain bằng trigger DB. Nhánh MÓN match cả **phraseto** (chặt → dist 0) lẫn **plainto** (recall
→ dist nhỏ), nhờ đó **bỏ hẳn nhánh match category-only**. Không thêm epsilon: phraseto khớp →
dist 0 bất kể qua name hay category.

Quyết định đã chốt: **cột tsvector lưu sẵn** (không index biểu thức) vì có phraseto; **nối
category trước name**; **trigger DB** maintain (không sửa insert site app); tier dist
`0 / SYN_LEX_DIST(0.03) / LOOSE_LEX_DIST(0.12)`, plainto-only **vẫn tính coverage** (0.12 < 0.2).

## Checklist (theo thứ tự phụ thuộc)

- [x] `01_schema_search_vec.md` — `db/init/04_menu_search_vec.sql`: cột + 2 trigger + backfill + GIN index; chạy tay lên DB dev (`6d56788`)
- [x] `02_dishes_combined_match.md` — `dishes.ts`: dùng `search_vec`, plainto gate + cờ phraseto, bỏ category-only, hằng `LOOSE_LEX_DIST` (`da00dd4`)
- [x] `03_dishes_tests.md` — `dishes.test.ts`: bỏ assert category-only; thêm 3 tier; integration chạm Postgres thật (cột + trigger + EXPLAIN dùng index) (`a3af50c`)
- [ ] `04_finalize.md` — `pnpm lint && pnpm test && pnpm build` xanh (PR: chờ user)

## MUST nhắc lại (AGENTS.md)

- **Schema additive**: file SQL mới đánh số kế tiếp (`04_*`), không sửa `01/02/03_*.sql` đã apply.
  Dùng `IF NOT EXISTS` / `CREATE OR REPLACE`. DB đã có dữ liệu → chạy file mới **bằng tay**.
- **SQL tham số hoá `$1,$2…`** qua `query()`; **never** nội suy chuỗi vào SQL (RADIUS_M hằng nội
  bộ vẫn nội suy như cũ là OK).
- **Validate-at-the-edge**: không đổi (route cũ đã validate); chỉ sửa tầng lib.
- **Không Drizzle/ORM**, không tạo `Pool` mới — tái dùng `query()` trong `src/lib/db.ts`.
- **Read-before-write Next 16**: task này không đụng route/page nên ít rủi ro, vẫn không tin trí nhớ.
- **Integration test chạm DB phải hit Postgres thật** (test DB), không mock che rủi ro SQL/schema.
- File ≤300 LOC; `dishes.ts` đang ~230 dòng, sau khi bỏ UNION sẽ gọn hơn.

## Ghi chú khi làm theo task

- Khi tick xong task, thêm **link commit** vào file task — **không** tạo commit docs riêng cho việc đó.
