# 02 — Extract: bỏ `category`, gắn type-tag khi không có món

## Vì sao
Trục food/drink chuyển sang tag. Extract không cần field `category` nữa; thay vào đó khi không
trích được tên món cụ thể thì gắn 1 type-tag để rank vẫn phân biệt được ăn/uống.

## Việc
- `app/src/lib/types.ts`: bỏ `category` khỏi `ParsedQuery`; bỏ type `FoodCategory` nếu hết tham chiếu
  (kiểm sau khi task 03 xong — có thể để lại tới task 03 nếu candidates/dishes còn import).
- `app/src/lib/extract.ts`:
  - Bỏ `category` khỏi `RawExtraction`, `fallback()`, `parseExtraction()`, `responseSchema`,
    và hàm `normalizeCategory`.
  - Sửa `systemInstruction`: bỏ mô tả `category`; thêm rule "nếu KHÔNG có tên món cụ thể, chọn
    ĐÚNG 1 tag loại trong {quán ăn, giải khát} bỏ vào `tags`". 2 tag này
    đã nằm trong `vocabTags` (task 01) nên qua validate. (`tráng miệng`/`ăn vặt` để Gemini dùng
    tự do như tag vibe thường, không cần liệt kê riêng.)
- Test: `extract.test.ts` bỏ các case `category`; thêm case "không có món → tags chứa type-tag".
  `extractCache.test.ts` bỏ `category` khỏi object `FALLBACK`.

## Done khi
- `ParsedQuery` không còn `category`; `pnpm test` (extract, extractCache) xanh.
- Lệch prompt note "why" nếu cần trong commit.
