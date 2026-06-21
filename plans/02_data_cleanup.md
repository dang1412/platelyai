# Plan 02 — Data cleanup: phân loại `menu_categories.kind`

> Làm sạch dữ liệu để [Search API](./01_search_api.md) không trả nhầm **đồ thêm / topping / gia vị**
> khi user tìm "món ăn" / "đồ uống". File liên quan: `db/init/01_schema.sql` (cột `kind`),
> `app/src/lib/dishes.ts` + `candidates.ts` (lọc cứng `mc.kind = category`).

## Vấn đề

`menu_categories.kind ∈ {food, drink, other}`; `menu_items` kế thừa `kind` qua `category_id`. Search
lọc cứng `mc.kind = parsed.category`. Nhiều category **đồ thêm** (topping, ăn kèm, nước chấm, đồ gọi
thêm lẩu…) đang bị gán `food`/`drink` → lẫn vào kết quả tìm món/đồ uống (vd "trà sữa" trả ra category
topping "trân châu, thạch").

Mục tiêu: gán `kind='other'` cho category **thuần đồ thêm**. **Ràng buộc**: KHÔNG đổi category trộn cả
món chính — đổi sẽ loại oan món chính khỏi search (vd category "Món thêm lẩu" chứa *Bò/Tôm/Mực thêm lẩu*;
"Gọi thêm (cơm quê)" chứa *Cá kho, Thịt kho*).

## Cách làm — quét tên + lọc bảo thủ, chia 2 tier

Phân loại ở **cấp category** (kind là thuộc tính của category), dựa trên **tên category** + kiểm chứng
bằng mẫu `menu_items` thực tế. Không dùng tên item (một category đồ-thêm vẫn toàn item là đồ ăn).

**Bước 1 — candidate** (food/drink có tên kiểu đồ thêm):
```
include ~ '(topping|món thêm|đồ thêm|thêm món|ăn kèm|gọi thêm|gọi kèm|^nước chấm|^nước sốt|ăn vặt thêm|đồ gọi thêm|đồ dời thêm)'
```
Từ khoá GÂY NHIỄU phải tránh trong include: `sốt` (→ "gà sốt" là **món chính**), `trân châu`/`combo`
(→ "trà sữa trân châu", "combo bbq" là **chính**). Vì vậy include KHÔNG chứa các từ này.

**Bước 2 — loại tên trộn món chính** (dấu hiệu category hỗn hợp → bỏ khỏi candidate):
```
exclude ~ '(&|/| và |combo|món chính|khai vị|nhậu|nướng|hàn quốc|đặc biệt|đặc sắc|đặc trưng|truyền thống|set |buffet|bao gồm)'
```
(vd loại "món nhậu & ăn kèm", "gà rán - gà sốt", "trà sữa (giá đã **bao gồm** topping)".)

→ Còn **72 category / ~499 item**. Tách 2 tier:

| Tier | Định nghĩa | Ví dụ | Xử lý |
|---|---|---|---|
| **A — đồ phụ thuần** | `topping*` (bất kỳ) **hoặc** (`ăn kèm`/`nước chấm`/`nước sốt`/`ăn vặt thêm` **và** không `lẩu`/`gạo`) | Topping Tteokbokki, Món Ăn Kèm, Đồ Ăn Kèm (Side Dishes), Nước chấm, Ăn vặt thêm, Topping Gọi Thêm | **✅ đã đổi `other`** |
| **B — chứa món chính (defer)** | còn lại: `*lẩu` (Bò/Tôm/Mực thêm lẩu), `món thêm`/`thêm món` generic, `gọi thêm (cơm quê)` (Cá kho), `ăn kèm từ gạo` | Món Thêm Lẩu, Đồ ăn kèm Lẩu, Gọi Thêm (Cơm Quê), Món Thêm | **⏸ giữ nguyên** |

Tier A xếp mọi `topping*` vào nhóm thuần (topping = đồ phụ theo định nghĩa, kể cả "Topping Gọi Thêm").
Tier B giữ lại vì item bên trong là protein/món kho → đổi sẽ loại oan khỏi search.

## Đã áp dụng (✅ 2026-06-21)

```sql
-- Backup trước: backups/plately_20260621_174619.dump (pg_dump -Fc, local-only)
BEGIN;
UPDATE menu_categories SET kind='other'
WHERE kind IN ('food','drink')
  AND lower(category_name) ~ '(topping|ăn kèm|^nước chấm|^nước sốt|ăn vặt thêm)'
  AND lower(category_name) !~ '(&|/| và |combo|món chính|khai vị|nhậu|nướng|hàn quốc|đặc biệt|đặc sắc|đặc trưng|truyền thống|set |buffet|bao gồm|gạo)'
  AND (lower(category_name) ~ 'topping' OR lower(category_name) !~ 'lẩu');
COMMIT;
```
**Kết quả**: `UPDATE 46` (food 2805→2760, drink 2269→2268, other 771→817). Verify: 0 category Tier A
còn food/drink; 0 category `lẩu`-không-topping bị đổi nhầm (9 cat lẩu food giữ nguyên = Tier B).

## Việc còn lại (chưa làm)

1. **Tier B — duyệt thủ công**: `*lẩu`, `món thêm`, `gọi thêm (cơm quê)`. Cần tách item: protein/rau
   nhúng lẩu là "đồ thêm" thật, nhưng cá kho/thịt kho là món chính. Có thể cần reclassify ở **cấp item**
   (thêm cột override) thay vì cấp category — ngoài scope đợt này.
2. **Recall ngược**: category đang `other` mà thực ra là **món chính** bị gán nhầm (chưa kiểm).
3. **Tự động hoá**: khi import data mới, chạy lại predicate Tier A (idempotent — chỉ chạm food/drink
   khớp). Cân nhắc đưa vào script seed/migration thay vì chạy tay.

## Rollback

`other` → `food`/`drink` không suy ra được sau khi đổi (mất kind gốc). Khôi phục từ backup:
```bash
PGPASSWORD=… pg_restore -h localhost -p 5432 -U plately -d plately --clean --if-exists \
  backups/plately_20260621_174619.dump
```
