# 07 — Gộp "category món" thành 1 cột FTS cho match phraseto + plainto

## Mục tiêu

Thêm một cột tsvector gộp **`category_name` + `name`** (thứ tự: "category món") vào
`menu_items`, để nhánh MÓN match cả **phraseto** (cụm liền kề, đúng thứ tự → khớp chặt) lẫn
**plainto** (đủ token, không cần thứ tự/liền kề → recall). Nhờ cột này, **bỏ hẳn nhánh match
category-only** hiện tại (UNION thứ 2 trong `resolveDishes`) — token category đã nằm sẵn trong
cột gộp.

Không có route/màn hình mới. Thay đổi nằm ở schema + `src/lib/dishes.ts` (tầng query nhánh MÓN).

## Vì sao

Menu Việt hay cắt tên món chỉ còn biến thể ("Tái", "Nạm") dưới category mang phần gốc
("Phở bò"). FTS hiện chạy `phraseto_tsquery` trên **mỗi tên món riêng** (`to_tsvector(lower(name))`)
nên hỏi `"phở bò tái"` **trượt** món tên "Tái". Nhánh category-only được thêm để vá, nhưng nó
là một UNION riêng + chỉ resolve theo `category_id`, không kết hợp được token name + category
trong một cụm.

Gộp `category_name || ' ' || name` vào một tsvector:
- `"Tái" (cat "Phở bò")` → `'phở':1 'bò':2 'tái':3`.
- Hỏi `"phở bò tái"`: **phraseto** khớp (cụm liền kề, đúng thứ tự) → dist 0.
- Hỏi `"phở tái"` (bỏ "bò") hoặc `"tái phở bò"` (khác thứ tự): phraseto trượt nhưng **plainto**
  khớp (đủ token) → dist nhỏ > 0 (tier recall).

(Đã verify trên DB thật trong phần thảo luận: phraseto cần liền kề + đúng thứ tự nối; dấu câu —
ngoặc, phẩy — bị strip, **không** tạo gap vị trí; chỉ TỪ thật chen giữa mới phá liền kề.)

## Quyết định đã chốt (tunable, ghi để chỉnh sau)

- **Cột lưu sẵn `search_vec tsvector`** (Option 1), **không** dùng index biểu thức trên text.
  Lý do: chạy cả phraseto → phrase **luôn recheck vị trí**; index biểu thức sẽ recompute
  `to_tsvector` mỗi dòng ứng viên mỗi query, cột lưu sẵn thì recheck chỉ đọc cột.
- **Thứ tự nối = "category món"** (`category_name` trước, `name` sau) — khớp cách user gõ
  gốc-món trước, biến-thể sau ("phở bò" + "tái").
- **Không thêm epsilon** phân biệt tên-đích-danh vs khớp-qua-category: **phraseto khớp → dist 0**
  bất kể khớp nhờ name hay category (theo yêu cầu). Chip có thể hoà dist=0 — chấp nhận.
- **Tier dist** (nhánh MÓN):
  | Khớp | dist | Tính coverage? |
  | --- | --- | --- |
  | phraseto trên `search_vec`, query gốc | `0` | ✅ |
  | phraseto trên `search_vec`, biến thể đồng nghĩa (synonyms.ts) | `SYN_LEX_DIST` (0.03) | ✅ |
  | chỉ plainto trên `search_vec` (đủ token, không liền kề) | `LOOSE_LEX_DIST` (**0.12**, mới) | ✅ (vì < `COVERAGE_DIST_THRESHOLD` 0.2) |
  - `LOOSE_LEX_DIST = 0.12` < `COVERAGE_DIST_THRESHOLD = 0.2` → khớp plainto **vẫn tính phủ**
    (coi "Tái (Phở bò)" là đã phủ "phở bò tái" — đúng ngữ nghĩa). Muốn loại khỏi coverage thì
    đặt > 0.2. Tunable.
- **Giữ `synonyms.ts`** (expandSynonyms) — vẫn mở rộng biến thể cho cả phraseto lẫn plainto.
- **Bỏ nhánh category-only**: xoá UNION thứ 2 trong `resolveDishes` + hằng `LEX_CATEGORY_DIST`.
  Lọc `kind` (food/drink) **giữ nguyên** (độc lập với việc match tên category).
- **Maintain cột bằng trigger DB** (không sửa insert site app): trigger trên `menu_items`
  (INSERT/UPDATE name|category_id) + trigger trên `menu_categories` (UPDATE category_name →
  re-derive các item con). Không có insert path nào ở app phải đổi.

## Luồng

```
query "phở bò tái"
  → dishes.ts: expandSynonyms → variants[]
  → 1 query duy nhất trên menu_items:
        WHERE search_vec @@ plainto(variants)        ← GATE rộng nhất, hit GIN(search_vec)
        SELECT name_exact  = search_vec @@ phraseto(query gốc)
               name_phrase = search_vec @@ phraseto(variants)
  → JS gán dist: name_exact?0 : name_phrase?SYN_LEX_DIST : LOOSE_LEX_DIST
  → (không còn nhánh category-only)
  → candidates/rank như cũ
```
phraseto-match ⊆ plainto-match (liền kề ⇒ có mặt) nên dùng plainto làm gate là đủ, hai cờ
phraseto chỉ tinh chỉnh dist trên cùng `search_vec`.

## Schema (additive — file mới `db/init/04_menu_search_vec.sql`)

> File `db/init/*.sql` chỉ chạy khi volume trống. DB dev/thật đã có dữ liệu → **chạy file này
> bằng tay** (psql) sau khi viết. Tất cả lệnh additive + `IF NOT EXISTS`.

```sql
-- 1) Cột mới (additive)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS search_vec tsvector;

-- 2) Hàm derive: "category món" → tsvector('simple', lower(...))
CREATE OR REPLACE FUNCTION menu_items_search_vec(p_category_id BIGINT, p_name TEXT)
RETURNS tsvector LANGUAGE sql STABLE AS $$
  SELECT to_tsvector('simple', lower(
    coalesce((SELECT category_name FROM menu_categories WHERE id = p_category_id), '')
    || ' ' || coalesce(p_name, '')));
$$;

-- 3) Trigger trên menu_items (đổi name hoặc category_id → recompute)
CREATE OR REPLACE FUNCTION trg_menu_items_search_vec() RETURNS trigger ... -- set NEW.search_vec
-- BEFORE INSERT OR UPDATE OF name, category_id ON menu_items

-- 4) Trigger trên menu_categories (đổi category_name → re-derive item con)
CREATE OR REPLACE FUNCTION trg_menu_categories_propagate() RETURNS trigger ...
-- AFTER UPDATE OF category_name ON menu_categories → UPDATE menu_items con

-- 5) Backfill toàn bảng (join category, item NULL category → chỉ name)
UPDATE menu_items mi SET search_vec = menu_items_search_vec(mi.category_id, mi.name);

-- 6) GIN index cho cả phraseto + plainto
CREATE INDEX IF NOT EXISTS menu_items_search_vec_idx ON menu_items USING GIN (search_vec);
```

Index cũ `menu_items_name_fts_idx` (trên `to_tsvector(lower(name))`) trở nên **dư thừa** với
nhánh MÓN sau thay đổi — **giữ lại** lần này (drop là bước riêng theo §4 AGENTS), ghi chú "cleanup
sau" trong file SQL.

## Backend — `src/lib/dishes.ts`

- Thay biểu thức FTS `to_tsvector('simple', lower(mi.name))` → cột **`mi.search_vec`** ở nhánh tên.
- WHERE gate đổi `phraseto` → **`plainto_tsquery`** (OR các biến thể), vẫn hit GIN(search_vec).
- Thêm cờ `name_phrase = search_vec @@ (phraseto OR variants)` bên cạnh `name_exact =
  search_vec @@ phraseto(query gốc)`.
- **Xoá** nhánh UNION category-only + hằng `LEX_CATEGORY_DIST`. Thêm hằng `LOOSE_LEX_DIST = 0.12`.
- Gán dist: `name_exact ? 0 : name_phrase ? SYN_LEX_DIST : LOOSE_LEX_DIST`.
- `kindFilter`/`priceFilter`/geo/cap `DISH_PER_RESTAURANT`/order **giữ nguyên** (chỉ một nhánh nên
  không cần UNION ALL nữa → query gọn hơn). `capOrder` đổi `name_any` → `name_phrase`.
- **MUST**: vẫn `query()` + tham số hoá `$n`; validate đã ở route (không đổi).

## Frontend

Không đổi. `MatchedDish`/chip dùng `name`/`price`/`dist` như cũ.

## Bảng file đụng tới

| File | Việc |
| --- | --- |
| `db/init/04_menu_search_vec.sql` | **mới** — cột + 2 trigger + backfill + GIN index |
| `app/src/lib/dishes.ts` | đổi sang `search_vec`, plainto gate + cờ phraseto, bỏ category-only, hằng mới |
| `app/src/lib/dishes.test.ts` | bỏ assert category-only; thêm case phraseto→0 / synonym→SYN / plainto-only→LOOSE |
| `plans/07_dish_combined_search.md` | tài liệu này |
| `tasks/07_dish_combined_search/` | task list |

## Test & guardrails

- **Unit (`dishes.test.ts`, mock DB)**: query dùng `search_vec`; WHERE có `plainto_tsquery`;
  SELECT có `phraseto_tsquery`; **không** còn UNION category-only; gán dist đúng 3 tier.
- **Integration (Postgres test thật)**: insert 1 quán có món "Tái" dưới category "Phở bò" →
  `resolveDishes(["phở bò tái"])` ra món đó dist 0 (phraseto); `resolveDishes(["phở tái"])` ra
  cùng món dist `LOOSE_LEX_DIST` (plainto-only). Kiểm trigger: đổi `category_name` → `search_vec`
  con cập nhật. EXPLAIN: query hit `menu_items_search_vec_idx` (Bitmap Index Scan, không Seq Scan).
- `pnpm lint && pnpm test && pnpm build` xanh trước PR.

## Ngoài scope (không làm lần này)

- Drop `menu_items_name_fts_idx` / `menu_categories_name_fts_idx` dư thừa (bước cleanup riêng).
- Bật lại semantic KNN (vẫn tạm tắt).
- `ts_rank_cd`/BM25 để xếp hạng trong tier — hiện dist rời rạc là đủ.
- Tách tier phrase-trên-cột-gộp khỏi tier tên-đích-danh bằng epsilon (đã chốt: không cần).
