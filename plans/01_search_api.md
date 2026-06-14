# Plan 01 — Search API

> Trạng thái: **DRAFT — chờ confirm**. Viết lại gọn, không bám sát code cũ; chỉ tái dùng vài mảnh
> logic nhỏ (LLM extract, dish KNN+lexical, geocode, công thức rerank). Code tham khảo: `old/app/src`.

## 1. Mục tiêu & I/O

`GET /api/search`

**Input**
- `q` (string, bắt buộc): câu tự nhiên của user.
- `lat`, `lng` (optional): toạ độ thiết bị. Ưu tiên hơn địa điểm gõ trong câu.

**Output**
```jsonc
{
  "parsed": { /* 6 yếu tố đã trích, để UI hiển thị "đang hiểu query thế này" */ },
  "results": [
    {
      "id", "name", "address", "rating", "ratingCount",
      "tags": ["cà phê", ...],          // vibe tags của quán
      "website", "googlePlaceId",
      "distanceM": 420,                  // null nếu không có origin
      "matchedDishes": [ { "name": "Phở bò tái", "price": 45000 }, ... ]
    }
  ]
}
```

## 2. Sáu yếu tố trích từ query (một lần gọi LLM)

| # | Field | Kiểu | Vai trò | Mô tả |
|---|---|---|---|---|
| 1 | `category` | `'food' \| 'drink' \| null` | **lọc cứng** | food = đồ ăn (gồm ăn vặt); drink = giải khát + chè/kem/sữa chua/tráng miệng; null = không rõ |
| 2 | `dishes` | `string[]` | **lọc cứng** | tên món cụ thể (`["phở bò","trà sữa"]`); `[]` nếu query chỉ nói loại chung ("quán cơm") |
| 3 | `tags` | `string[]` | ranking | vibe tag, **chỉ chọn trong vocab bảng `tags`**; `[]` nếu không có |
| 4 | `location` | `string \| null` | **lọc cứng** | tên địa điểm trong câu; có origin → giới hạn bán kính 1.5km |
| 5 | `maxPrice` | `number \| null` | **lọc cứng** | giá tối đa **một món** (VND); lọc món `price <= maxPrice` |
| 6 | `wantsCheap` | `boolean` | ranking | user muốn "rẻ" → cộng trọng số cho quán có món rẻ |

> Lọc cứng (DB): **1, 2, 4, 5**. Ảnh hưởng ranking: **3, 6**.

## 3. Pipeline (4 bước, một luồng duy nhất)

```
q (+lat,lng)
   │
   ▼  [1] PARSE     LLM → { category, dishes, tags, location, maxPrice, wantsCheap }
   │
   ▼  [2] ORIGIN    coords request  ──or──  geocode(location)   → LatLng | null
   │
   ▼  [3] CANDIDATES  (lọc cứng 1,2,4,5)
   │        ├─ dishes.length > 0  → nhánh MÓN
   │        └─ dishes.length == 0 → nhánh QUÁN
   │
   ▼  [4] RANK      rerank JS (gần + rating + tag-match[3] + cheap[6]) → top 30
   │
   ▼  { parsed, results }
```

Bỏ hẳn các "mode" rời rạc của code cũ (tags-mode / name-mode / keyword fallback) → một luồng.

### Bước 1 — Parse (LLM)
- Gemini `gemini-2.5-flash-lite`, structured output (JSON schema), system prompt mô tả 6 trường.
- Vocab tag (yếu tố 3) **nạp từ bảng `tags`** (cache in-memory), nhồi vào prompt; validate lại
  output chỉ giữ tag có trong vocab.
- `wantsCheap` = LLM trả "rẻ" trong sort **hoặc** tag mang nghĩa rẻ/bình dân.
- LLM lỗi / thiếu key → fallback: coi `q` là semantic thuần, các field còn lại rỗng/null.
- *Tái dùng:* prompt + chuẩn hoá category/sort của `old/app/src/lib/extract.ts`.

### Bước 2 — Origin
- `lat,lng` hợp lệ (đã validate range) thắng. Không có → `geocode(location)` nếu có location.
- *Tái dùng:* `old/app/src/lib/geocode.ts` (Google Places `searchText`, cache theo tên).

### Bước 3 — Sinh ứng viên (lọc cứng)

**Nhánh MÓN** (`dishes` không rỗng):
1. `resolveDishes(dishes, maxPrice, category, origin)` → các `menu_items` khớp:
   - Semantic KNN trên `menu_items.embedding` (OpenAI `text-embedding-3-small`, input `"Món: <tên>"`).
   - Lexical: tên món khớp **ranh giới từ có dấu** trong `mi.name` (dist=0), hoặc trong
     `menu_categories.category_name` (dist nhỏ).
   - **Lọc cứng `maxPrice` (5)** và **`menu_categories.kind = category` (1)** NGAY trong SQL.
   - **KHÔNG** lọc cứng bán kính (quyết định 4) — distance tính để rank, không cắt.
2. Gom `menu_items` → quán: `coverage` = số tên-món-hỏi được phủ / tổng; `matchedDishes` = tối đa 3
   món/quán làm chip; `distanceM` (nếu có origin) để rerank.
3. *Tái dùng:* `old/app/src/lib/dishes.ts` (thêm lọc `kind`, bỏ lọc bán kính cứng).

**Nhánh QUÁN** (`dishes` rỗng):
1. Chọn `restaurants` lọc cứng: `category` (1) qua `serves_food/serves_drink`, bán kính (4) qua
   `ST_DWithin`. Không origin → lấy top ~100 theo `rating_count/rating` để rerank bounded.
2. Có `maxPrice` (5) → thêm `EXISTS` món `price <= maxPrice` đúng `kind`; gắn vài món trong tầm giá.
3. `wantsCheap` (6) → gắn 3 món rẻ nhất đúng kind + set `cheapness`.

### Bước 4 — Rank
JS thuần, không chạm DB. Điểm = tổng có trọng số:

| Tín hiệu | Nguồn | Ghi chú |
|---|---|---|
| `coverage` | nhánh món | độ phủ số món hỏi (nền cao — relevance) |
| `matchQuality` | nhánh món | `1 - minDist/threshold` |
| `tagCoverage` (**3**) | `tags` ∩ tag quán | tỉ lệ vibe tag khớp |
| `nearness` | `distanceM` | `1 - d/1500`; bơm thêm nếu sort "gần" |
| `ratingNorm` | rating Bayesian | kéo quán ít lượt rate về prior |
| `cheapness` (**6**) | món rẻ nhất | nền 0, chỉ tác động khi `wantsCheap` |

*Tái dùng:* công thức + trọng số `old/app/src/lib/rank.ts` (đều tunable).

## 4. Module layout (app mới, SQL thuần qua `pg`)

```
src/lib/db.ts        pg Pool + helper query<T>(sql, params)
src/lib/extract.ts   parse query (Gemini) → ParsedQuery
src/lib/embed.ts     OpenAI embeddings + toVectorLiteral
src/lib/geocode.ts   địa điểm → LatLng
src/lib/dishes.ts    resolveDishes (KNN + lexical)
src/lib/rank.ts      rerank
src/lib/types.ts     ParsedQuery, RestaurantSummary, MatchedDish, SearchResponse
src/app/api/search/route.ts   orchestrator (4 bước trên)
```

> Khác code cũ: dùng `pg` trực tiếp thay `drizzle` (đã chốt bỏ drizzle). Query vẫn viết SQL thuần
> giống code cũ nên chuyển đổi nhẹ.

## 5. Hằng số tunable (khởi điểm từ code cũ)

| Tên | Giá trị | Ý nghĩa |
|---|---|---|
| `RADIUS_M` | 1500 | bán kính lọc cứng khi có origin |
| `LIMIT` | 30 | số kết quả trả về |
| `DISH_TOP_K` | 150 | ứng viên KNN mỗi tên món |
| `DISH_DIST_THRESHOLD` | 0.30 | ngưỡng giữ món (recall) |
| `COVERAGE_DIST_THRESHOLD` | 0.20 | ngưỡng "khớp chắc" để tính coverage |
| `CHEAP_REF` | 40000 | mốc chuẩn hoá cheapness |
| trọng số rerank | W_COV 3 / W_MATCH 1.5 / W_TAG 1.5 / dist 0.5 / rating 0.5 + SORT_BOOST 2 | |

## 6. Quyết định đã chốt

1. **Provider**: Gemini (extract) + OpenAI `text-embedding-3-small` (dish KNN). Embedding trong DB
   phải sinh đúng model này.
2. **`category` ở nhánh MÓN**: **lọc cứng `menu_categories.kind = category`** (chọn (b)). Bỏ lọc thì
   tên khớp sẽ kéo cả món thêm lặt vặt (topping/nước chấm) trùng tên.
3. **Không origin / geocode fail**: rank theo các yếu tố còn lại (rating, tag, cheap), **không có
   distance**.
4. **Geo ở nhánh MÓN**: **không** lọc cứng bán kính — distance chỉ là tín hiệu ranking (vẫn rank
   theo gần khi có origin). Nhánh QUÁN vẫn lọc cứng 1.5km.
5. Bỏ qua reviews / semantic cấp quán (schema mới không có embedding cấp quán).
```
