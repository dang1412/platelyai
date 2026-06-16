# Plan 01.4b — Synonyms (đồng nghĩa thủ công cho nhánh lexical)

> Bổ sung cho [01_4_dishes](./01_4_dishes.md). Files: `app/src/lib/synonyms.ts` (mới), `app/src/lib/dishes.ts`.
> Trạng thái: **✅ xong** — 9/9 test xanh (gồm test nhánh đồng nghĩa), typecheck sạch.

## Vì sao có bước này — semantic không tách được sắc thái món Việt

Đo thật cosine `text-embedding-3-small` (1536 dims, query `"Món: <tên>"`, không lowercase — khớp
đúng dạng đã sinh embedding trong DB):

| query | đồng nghĩa THẬT | dist | "kẻ nhiễu" cùng khung | dist |
|---|---|---|---|---|
| bún riêu | bún cua | 0.231 | **bún bò** | **0.205** ✗ gần hơn |
| gà rán | gà chiên giòn | 0.208 | **gà nướng** | **0.183** ✗ gần hơn |
| phở gà | phở gà đùi | 0.051 | phở bò tái | 0.166 |

Pattern nhất quán: với tên món Việt **ngắn**, embedding bám **khung bề mặt** ("bún + X", "gà +
[chế biến]"), coi mọi biến thể na ná nhau → thường xếp món SAI (bún bò, gà nướng) **trên** đồng
nghĩa ĐÚNG (bún cua, gà chiên). Tức cái semantic *được kỳ vọng* làm (nối đồng nghĩa) thì làm sai;
cái nó làm đúng (phở gà ≈ phở gà đùi) thì lexical ranh-giới-từ cũng bắt được vì chuỗi nằm nguyên
trong tên. Baseline cosine ~0.65 cho 2 món bất kỳ → dải dùng được bị nén còn ~0.18–0.35, mong manh.

**Kết luận:** giữ lexical làm xương sống precision/coverage; nối đồng nghĩa bằng **bảng thủ công**
(chính xác, rẻ, kiểm soát được) thay vì dựa embedding mờ. Semantic KNN vẫn giữ làm recall fallback
nhưng không gánh việc tách đồng nghĩa.

## Thiết kế — `synonyms.ts`

- `SYNONYM_GROUPS: string[][]` — mỗi nhóm là các từ/cụm **tương đương**, đều thường + **CÓ DẤU**
  (lexical khớp có dấu). Phân loại: cách chế biến (`rán/chiên`), nguyên liệu/vùng miền
  (`heo/lợn`, `dứa/thơm/khóm`), chính tả (`hủ tiếu/hủ tíu`), cấp món (`bún riêu/bún riêu cua/bún cua`).
  Thêm cặp mới = sửa data, **không đụng code**.
- `expandSynonyms(q)` → các biến thể tên món (thay cụm đồng nghĩa khớp ranh giới từ). **Query gốc
  luôn ở `[0]`** (call site dựa vào để phân biệt đích danh vs đồng nghĩa). Compose qua nhiều nhóm
  (`"gà chiên nướng"` → 4 biến thể), chặn bùng nổ bằng `MAX_VARIANTS = 16`.
  Mỗi biến thể được đẩy thành 1 param `phraseto_tsquery('simple', $n)` ở call site (chống injection).

## Cắm vào nhánh lexical — 2 tsquery (FTS), UNION ALL

Để đích danh vẫn thắng đồng nghĩa, dùng 2 tsquery (mỗi biến thể 1 `phraseto_tsquery`, OR bằng `||`):

| tsquery | gồm | khớp `mi.name` → dist |
|---|---|---|
| `exactTsq` | chỉ tên gốc (`variants[0]`) | `0` — đích danh, mạnh nhất |
| `anyTsq` | gốc + tất cả đồng nghĩa | `SYN_LEX_DIST = 0.03` |
| (chỉ khớp tên category qua `anyTsq`) | — | `LEX_CATEGORY_DIST = 0.05` |

```sql
-- nhánh name (FTS GIN) ⊎ nhánh category (FTS menu_categories → btree category_id)
SELECT ..., (to_tsvector('simple', lower(mi.name)) @@ exactTsq) AS name_exact, TRUE AS name_any
FROM menu_items mi WHERE to_tsvector('simple', lower(mi.name)) @@ anyTsq
UNION ALL
SELECT ..., FALSE, FALSE FROM menu_items mi
WHERE mi.category_id IN (SELECT id FROM menu_categories WHERE to_tsvector('simple', lower(category_name)) @@ anyTsq)
```
```ts
add(r, r.name_exact ? 0 : r.name_any ? SYN_LEX_DIST : LEX_CATEGORY_DIST, queryDish);
```

`anyTsq` bao gồm cả gốc → kiểm `name_exact` trước. KNN / geo / price / kind **không đổi**. FTS vừa
giữ ngữ nghĩa ranh-giới-từ vừa dùng GIN index — xem perf ở [01_4_dishes](./01_4_dishes.md#perf-lexical-khi-scale--đã-giải-bằng-fts--union-all).

## Hằng số (tunable) — thêm vào bảng 01.4

| Tên | Giá trị | Ý nghĩa |
|---|---|---|
| `SYN_LEX_DIST` | 0.03 | dist món khớp qua đồng nghĩa |

Đặt `SYN_LEX_DIST < COVERAGE_DIST_THRESHOLD (0.20)` → đồng nghĩa **VẪN tính coverage** (đã curate
đúng, khác semantic mờ), nhưng **> 0** nên món trùng tên đích danh (`dist=0`) luôn thắng khi chọn chip.

## Test

- `synonyms.test.ts`: `expandSynonyms` (query-first, khớp nguyên-từ không phải từ-con, `bánh mỳ`↔`bánh
  mì`, compose đa tầng, không đệ quy rác, bounded).
- `dishes.test.ts`: hỏi `"gà rán"` → biến thể `"gà chiên"` vào params + SQL chứa `phraseto_tsquery`,
  khớp `"Gà chiên giòn"` → `SYN_LEX_DIST`. Mock lexical dùng `name_exact`/`name_any`.

## Hiệu chỉnh theo DB thật

`SYNONYM_GROUPS` đã được rà theo tần suất thật trong `menu_items.name` (37k món): chỉ giữ cặp mà cả
hai phía có thật (hoặc phía DB ít nhưng query hay gõ), **loại** các cặp gộp món khác nhau
(`nướng/quay`, `tôm/tép`, `dứa/thơm` — "thơm" còn nhập nhằng "thơm lừng"). Quy tắc: **member trong 1
nhóm không được là từ-con của nhau** (vd bỏ "bún riêu cua" — đã chứa "bún riêu" — tránh đệ quy sinh
biến thể rác). `expandSynonyms` lặp tới điểm bất động (bounded `MAX_VARIANTS`) để compose đa tầng:
"french fries" → "khoai tây chiên" → "khoai tây rán".

Recall thật (số `menu_items` khớp, chỉ tên gốc → +synonym):

| query | tên gốc | +synonym |
|---|---|---|
| gà rán | 210 | 445 (+235) |
| french fries | 3 | 227 (+224) |
| cà phê | 550 | 927 (+377) |
| bún cua | 1 | 131 (+130) |

## Việc tiếp

Cân nhắc đo nhánh semantic-only trên query log để quyết có siết/bỏ KNN không.
