# Plan 01.3 — Embed (text → vector cho semantic match)

> Bước 3 của [Search API](./01_search_api.md). File: `app/src/lib/embed.ts`.
> Trạng thái: **✅ xong** — 8/8 test xanh (toVectorLiteral + guards + mock OpenAI), typecheck sạch.

## Mục tiêu

Sinh embedding cho tên món user hỏi, để KNN trên `menu_items.embedding` (bước dishes dùng). Phải
khớp **đúng model/dims** mà pipeline đã dùng sinh embedding vào DB, nếu không cosine vô nghĩa.

## Input / Output

```ts
function embedQuery(text: string): Promise<number[] | null>      // 1 chuỗi → 1 vector
function embedMany(texts: string[]): Promise<number[][] | null>  // n chuỗi → n vector (đúng thứ tự)
function toVectorLiteral(vec: number[]): string                  // → '[1,2,3]' cho pgvector
```

- `embedQuery`/`embedMany` trả `null` khi: thiếu `OPENAI_API_KEY`, input rỗng, hoặc API lỗi.
- Module sinh ra vector **không kèm prefix** — prefix `"Món: "` do bước dishes thêm ở call site.

## Thiết kế

- **OpenAI `text-embedding-3-small`, 1536 dims** (chốt ở plan 01 §6.1). Hằng số `MODEL`, `DIMS`.
- Client khởi tạo **lazily trong hàm** (sau khi check key) → không throw lúc import khi thiếu key.
- `toVectorLiteral` thuần: `'[' + vec.join(',') + ']'`.
- Lỗi API → `null` (fail-safe; bước dishes vẫn còn nhánh lexical).

## Test (`app/src/lib/embed.test.ts`, vitest)

**`toVectorLiteral`** (thuần):

| vec | kỳ vọng |
|---|---|
| `[1,2,3]` | `"[1,2,3]"` |
| `[]` | `"[]"` |
| `[0.5,-0.25]` | `"[0.5,-0.25]"` |

**`embedQuery`/`embedMany`** (mock module `openai` qua `vi.mock`, `vi.stubEnv` cho key):

| Tình huống | kỳ vọng |
|---|---|
| thiếu `OPENAI_API_KEY` | `null`, không gọi API |
| `embedQuery("")` / `embedMany([])` | `null`, không gọi API |
| API ok | trả mảng vector đúng thứ tự input |
| API throw | `null` |

## Done khi
- `pnpm test embed` xanh; typecheck sạch.
