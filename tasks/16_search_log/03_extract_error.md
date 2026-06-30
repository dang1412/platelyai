# 03 — Surface lỗi LLM từ `extractQuery`

## Vì sao

Hiện `extractQuery` (`app/src/lib/extract.ts`) **nuốt** lỗi gọi Gemini (catch → `console.error` →
trả fallback) nên route không biết để ghi vào log. Cần đưa lỗi ra ngoài mà **vẫn giữ fallback**
(search không vỡ khi LLM lỗi).

## Việc

Sửa `app/src/lib/extract.ts`:

- Đổi chữ ký `extractQuery(q, vocabTags)` → trả `Promise<{ parsed: ParsedQuery; error: string | null }>`.
- Trong nhánh `catch (e)` (gọi Gemini fail): giữ `console.error` + **không cache** (như cũ),
  nhưng ghi lại message để cuối cùng trả `{ parsed: fallback(), error: String(e) }`
  (hoặc `e instanceof Error ? e.message : String(e)`).
- Các ca KHÔNG phải lỗi → `error: null`:
  - thiếu `GEMINI_API_KEY` hoặc `q` rỗng (early return fallback).
  - parse thành công (kể cả khi Gemini trả về extract rỗng hợp lệ).
- `parseExtraction` (hàm thuần) **giữ nguyên** — test hiện có không vỡ.
- Lưu ý cache (`getOrCompute`): chỉ cache `parsed` thành công như hiện tại; lỗi vẫn không cache.
  Cách gọn: để `getOrCompute` trả `ParsedQuery | null` như cũ, bắt lỗi qua biến ngoài hoặc
  trả error riêng — chọn cách đơn giản, không phá hành vi cache (cùng q không gọi lại Gemini).

## Done khi

- `extractQuery` trả `{ parsed, error }`; lỗi LLM → `error` có message, `parsed` vẫn là fallback.
- Hành vi cache không đổi (thành công cache, lỗi không cache).
- `pnpm lint` + `pnpm test` xanh (test `extract.test.ts` / `parseExtraction` vẫn pass).
