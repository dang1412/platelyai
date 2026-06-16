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
- `lexAlternationPattern(terms)` → 1 pattern POSIX cho `~` của Postgres khớp **bất kỳ** term như
  nguyên từ; cùng quy ước `[:alnum:]` + escape regex như nhánh lexical cũ.

## Cắm vào nhánh lexical — 2 pattern thay vì 1

Để đích danh vẫn thắng đồng nghĩa, dùng 2 param:

| param | pattern | khớp `mi.name` → dist |
|---|---|---|
| `$1` | chỉ tên gốc (`variants[0]`) | `0` — đích danh, mạnh nhất |
| `$2` | gốc + tất cả đồng nghĩa | `SYN_LEX_DIST = 0.03` |
| (chỉ khớp tên category qua `$2`) | — | `LEX_CATEGORY_DIST = 0.05` |

```sql
SELECT ..., (lower(mi.name) ~ $1) AS name_exact,
            (lower(mi.name) ~ $2) AS name_any
WHERE (lower(mi.name) ~ $2
   OR mi.category_id IN (SELECT id FROM menu_categories WHERE lower(category_name) ~ $2))
```
```ts
add(r, r.name_exact ? 0 : r.name_any ? SYN_LEX_DIST : LEX_CATEGORY_DIST, queryDish);
```

`name_any` bao gồm cả gốc (gốc ∈ alternation) → kiểm `name_exact` trước. KNN / geo / price / kind
**không đổi** — chỉ thay cách build pattern lexical.

## Hằng số (tunable) — thêm vào bảng 01.4

| Tên | Giá trị | Ý nghĩa |
|---|---|---|
| `SYN_LEX_DIST` | 0.03 | dist món khớp qua đồng nghĩa |

Đặt `SYN_LEX_DIST < COVERAGE_DIST_THRESHOLD (0.20)` → đồng nghĩa **VẪN tính coverage** (đã curate
đúng, khác semantic mờ), nhưng **> 0** nên món trùng tên đích danh (`dist=0`) luôn thắng khi chọn chip.

## Lưu ý perf

`$2` mở rộng thành alternation nhiều term → regex phức tạp hơn chút, nhưng vẫn là 1 lần quét như
cũ. Mọi known-limit seq-scan ở [01_4_dishes](./01_4_dishes.md#known-limit--perf-khi-không-có-origin-scale-toàn-quốc)
giữ nguyên (chữa bằng cụm trgm GIN + tách `OR`→`UNION` khi cần).

## Test (`app/src/lib/dishes.test.ts`)

Thêm: hỏi `"gà rán"` → `$2` chứa biến thể `"chiên"`, khớp `"Gà chiên giòn"` → `SYN_LEX_DIST`. Các
mock lexical cũ đổi `name_match` → `name_exact`/`name_any`.

## Việc tiếp

Mở rộng `SYNONYM_GROUPS` dựa trên `menu_items.name` THẬT trong DB (hiện mới seed ~12 nhóm); cân nhắc
đo nhánh semantic-only trên query log để quyết có siết/bỏ KNN không.
