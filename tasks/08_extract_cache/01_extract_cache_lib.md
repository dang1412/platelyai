# 01 — `extractCache.ts`: LRU + TTL + single-flight + buildKey

## Vì sao

Tách phần cache/dedupe thành lib thuần (không DB/mạng) để test trực tiếp và giữ `extract.ts` gọn.
Đây là nền cho task 02 tích hợp.

## Việc

Tạo **`app/src/lib/extractCache.ts`**:

- `buildKey(q: string, vocab: string[]): string`
  - `norm(q)` = `q.toLowerCase().trim()` + gộp khoảng trắng thừa (`/\s+/ → " "`).
  - `vocabSig` = chữ ký rẻ của vocab, ổn định theo nội dung (vd `vocab.length + ":" + hash(sorted
    vocab join "|")`; hash đơn giản kiểu djb2). Mục đích: admin đổi vocab tag → key khác.
  - Trả `` `${normQ}::${vocabSig}` ``.
- Cache LRU theo `Map<string, { value: ParsedQuery; exp: number }>`:
  - `CACHE_MAX = 1000`, `CACHE_TTL_MS = 6 * 60 * 60 * 1000` (export, tunable).
  - Đọc: hết hạn → xoá + coi như miss. Hit → bump recency (delete rồi set lại).
  - Ghi: set; nếu vượt `CACHE_MAX` → xoá entry cũ nhất (first key của Map).
- Single-flight: `Map<string, Promise<ParsedQuery | null>>` cho call đang bay.
- `getOrCompute(key, compute: () => Promise<ParsedQuery | null>): Promise<ParsedQuery | null>`
  - hit còn hạn → trả ngay.
  - in-flight có key → trả chính promise đó.
  - else: tạo `p = compute()`, lưu in-flight[key]=p; `await`; **finally** xoá in-flight[key];
    kết quả `!= null` → `cache.set`; trả kết quả (kể cả `null`).
- `_resetExtractCache(): void` — xoá cache + in-flight (test-only, mirror `tags.ts:_resetTagVocabCache`).

Tạo **`app/src/lib/extractCache.test.ts`** (unit thuần, `_resetExtractCache()` trong `beforeEach`):
- hit: 2 lượt `getOrCompute` cùng key → `compute` chạy **1 lần**, cùng kết quả.
- miss khi `compute` trả `null` → không cache → lượt sau `compute` chạy lại.
- LRU evict: nhồi > `CACHE_MAX` key → key cũ nhất bị đẩy ra (miss lại).
- TTL: `vi.useFakeTimers()`, quá `CACHE_TTL_MS` → miss lại.
- single-flight: gọi 2 lượt **đồng thời** (chưa await) cùng key → `compute` chạy 1 lần, cả hai nhận
  cùng promise/kết quả.
- `buildKey`: chuẩn hoá hoa/thường + khoảng trắng cho ra cùng key; vocab khác → key khác.

## Done khi

- `extractCache.ts` export `getOrCompute`, `buildKey`, `_resetExtractCache`, `CACHE_MAX`, `CACHE_TTL_MS`.
- `pnpm test extractCache` xanh; không import DB/mạng trong file lib.
