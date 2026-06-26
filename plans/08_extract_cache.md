# 08 — Cache kết quả extract (in-memory) + single-flight

## Mục tiêu

Cache kết quả `extractQuery` (ParsedQuery) **in-memory** trong vòng đời process, để cùng một câu
`q` không gọi lại Gemini. Giải quyết: (1) ca **bật/tắt vị trí** — `page.tsx` re-fetch `/api/search`
khi `coords` đổi nhưng `q` y nguyên (`page.tsx:54`, deps `[query, coords]`) → hiện gọi Gemini lại
vô ích; (2) lỗi **"high demand"** (503/429) do gọi trùng lặp + nhiều người search cùng lúc.

Thuần server-side, trong suốt với client. Không route mới, không UI, không schema, không dependency.

## Vì sao đúng chỗ này

`extractQuery(q, vocab)` chỉ phụ thuộc **câu chữ `q`** + **vocab tag** (nhồi vào systemInstruction),
**KHÔNG** phụ thuộc `origin`/toạ độ. Toạ độ chỉ đi vào bước sinh ứng viên (candidates). Nên bật/tắt
GPS = cùng input extract = **cache hit 100%**. Nhiều người gõ cùng "trà sữa"/"phở bò" cũng dùng chung.

## Luồng

```
/api/search (route, server)
  → loadTagVocab() [đã cache]
  → extractQuery(q, vocab):
       key = norm(q) + vocabSig
       ├─ cache hit (chưa hết TTL)        → trả ParsedQuery, KHÔNG gọi Gemini
       ├─ đang có call cùng key in-flight → await chính promise đó (single-flight)
       └─ miss → gọi Gemini → parse → CACHE nếu thành công → trả
  → candidates(origin) → rerank
```
- **Single-flight**: N request cùng `q` đến lúc cache chưa kịp ghi → gộp về **một** call Gemini
  (lấp khe đông người gõ cùng câu cùng lúc).
- **Chỉ cache thành công**: lỗi Gemini / thiếu key / `q` rỗng → `fallback()` và **KHÔNG cache**
  (để 503 thoáng qua được thử lại lần sau). Đồng nhất triết lý `tags.ts` ("lỗi → KHÔNG cache").

## Backend

### Lib thuần mới — `app/src/lib/extractCache.ts` (+ `extractCache.test.ts`)

Cache + single-flight, không chạm DB/mạng → unit test thuần (fake timers cho TTL).

- `buildKey(q: string, vocab: string[]): string` — `norm(q)` (lowercase + trim + gộp khoảng trắng)
  `+ ":" + vocabSig`. **vocabSig** = chữ ký rẻ của vocab (vd `length + hash(sorted.join("|"))`) —
  vì systemInstruction nhúng danh sách tag; vocab đổi → extraction có thể khác → phải vào key.
- LRU theo `Map` (cap **`CACHE_MAX = 1000`**, evict cũ nhất) + **TTL** (`CACHE_TTL_MS = 6h`).
  Cả hai **tunable**; TTL phòng prompt-logic đổi giữa các deploy (restart cũng xoá sạch).
- API gọn cho call site (tránh abstraction đầu cơ — KISS):
  `getOrCompute(key, compute: () => Promise<ParsedQuery | null>): Promise<ParsedQuery | null>`
  - hit còn hạn → trả ngay; in-flight → await; else chạy `compute`, lưu in-flight, settle xong:
    `null` (fallback/lỗi) → **không** cache; ParsedQuery → cache.set; luôn xoá in-flight.
- `_resetExtractCache()` — test-only, xoá cache + in-flight (mirror `tags.ts:_resetTagVocabCache`).

### Tích hợp — `app/src/lib/extract.ts`

`extractQuery`:
1. Early return **trước cache**: thiếu `GEMINI_API_KEY` hoặc `q` rỗng → `fallback()` (không cache).
2. `key = buildKey(q, vocab)`; bọc phần gọi Gemini trong `getOrCompute(key, compute)`.
   - `compute`: gọi `ai.models.generateContent(...)` + `parseExtraction(...)`. Thành công → trả
     ParsedQuery. Lỗi/parse fail/`text` rỗng → trả **`null`** (signal không cache).
3. `getOrCompute` trả `null` → `extractQuery` trả `fallback()`. ParsedQuery → trả thẳng.

Không đổi chữ ký `extractQuery` → `search/route.ts` không phải sửa.

## Frontend

Không đổi (cache server-side trong suốt).

## Schema

Không có. Không DB, không migration.

## Bảng file đụng tới

| File | Việc |
| --- | --- |
| `app/src/lib/extractCache.ts` | **mới** — LRU + TTL + single-flight + `buildKey` + `_reset` |
| `app/src/lib/extractCache.test.ts` | **mới** — unit thuần (hit/evict/TTL/single-flight/buildKey) |
| `app/src/lib/extract.ts` | bọc `extractQuery` qua cache; `compute` trả `null` khi fail |
| `app/src/lib/extract.test.ts` | thêm test caching (mock `@google/genai`): cùng `q` → 1 call; fail → không cache |
| `plans/08_extract_cache.md` | tài liệu này |
| `tasks/08_extract_cache/` | task list |

## Test & guardrails

- **Unit thuần `extractCache.test.ts`**: hit (compute gọi 1 lần cho 2 lượt cùng key); LRU evict ở
  cap; TTL hết hạn (vi.useFakeTimers) → miss lại; single-flight (2 lượt đồng thời → compute 1 lần,
  cùng kết quả); `compute` trả `null` → không cache (lần sau gọi lại); `buildKey` chuẩn hoá `q` +
  đổi theo vocab.
- **Unit `extract.test.ts`** (mock `@google/genai`): gọi `extractQuery` 2 lần cùng `q` → SDK
  `generateContent` chỉ chạy 1 lần; lần lỗi → không cache (lần sau gọi lại SDK). Reset cache giữa
  test bằng `_resetExtractCache()`. Giữ nguyên các test `parseExtraction` hiện có.
- Không có integration DB (feature không chạm DB).
- `pnpm lint && pnpm test && pnpm build` xanh trước PR.

## Quyết định mặc định đã chốt (chỉnh được)

- **In-memory** (theo yêu cầu) — per-process. Multi-instance: mỗi instance cache riêng, chấp nhận;
  nâng Redis sau (xem ngoài scope).
- **Scope = cache + single-flight**; **không** kèm retry/backoff lần này.
- `CACHE_MAX = 1000`, `CACHE_TTL_MS = 6h` — tunable.
- Key gồm **vocabSig** (đúng khi admin đổi vocab tag).
- Chỉ cache **kết quả Gemini thành công**; fallback/lỗi không cache.

## Mở rộng ngoài scope

- **Redis / cache chia sẻ** cho multi-instance (swap backend khi thật sự scale ngang).
- **Retry + backoff** trên 503/429 (bổ trợ, tách riêng).
- **Gemini context caching** (giảm token phần systemInstruction cố định).
- Cache `geocode(location)` (ý tưởng tương tự, tách riêng).
- Client-side memo kết quả search.
