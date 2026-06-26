# 02 — Bọc `extractQuery` qua cache + single-flight

## Vì sao

Đưa cache (task 01) vào đường gọi Gemini thật, chỉ cache kết quả thành công để 503/429 thoáng qua
vẫn được thử lại.

## Việc

Sửa **`app/src/lib/extract.ts`** — hàm `extractQuery(q, vocab)`:

1. Giữ early return **trước cache**: `!process.env.GEMINI_API_KEY || !q.trim()` → `fallback()`
   (không cache, không tính key).
2. `const key = buildKey(q, vocab);`
3. Bọc phần gọi Gemini trong `getOrCompute(key, compute)`:
   - `compute` = async: `ai.models.generateContent(...)` (giữ nguyên config/responseSchema hiện
     tại) → `text` rỗng **hoặc** lỗi (try/catch) **hoặc** `JSON.parse` fail → trả **`null`**
     (signal KHÔNG cache, vẫn log `console.error` như cũ). Thành công → trả
     `parseExtraction(JSON.parse(text), vocab)`.
   - Lưu ý: `parseExtraction` đã áp vocab → cache giá trị cuối, đúng vì key có vocabSig.
4. `const result = await getOrCompute(...)`; `return result ?? fallback();`

Không đổi chữ ký `extractQuery` → `search/route.ts` không phải sửa.

Sửa **`app/src/lib/extract.test.ts`** — thêm `describe("extractQuery cache")` (mock `@google/genai`):
- Mock `GoogleGenAI` sao cho `models.generateContent` trả JSON hợp lệ; set `process.env.GEMINI_API_KEY`.
- `_resetExtractCache()` + reset mock trong `beforeEach`.
- Gọi `extractQuery("phở bò", vocab)` 2 lần → `generateContent` chạy **1 lần**, kết quả giống nhau.
- Lần `generateContent` ném lỗi → `extractQuery` trả `fallback()` và **không cache**: gọi lại lần
  sau → `generateContent` chạy lại (chứng minh lỗi không bị cache).
- (Tuỳ chọn) đổi vocab → key khác → gọi Gemini lại.
- Giữ nguyên toàn bộ test `parseExtraction` cũ.

## Commit

`55d7a74` — feat(search): bọc extractQuery qua cache in-memory + single-flight

## Done khi

- `extractQuery` dùng `getOrCompute`; lỗi/parse-fail → `null` (không cache) → `fallback()`.
- `pnpm test extract` xanh (cả `parseExtraction` cũ lẫn caching mới).
- `pnpm build` xanh.
