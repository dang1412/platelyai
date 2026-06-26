# Feature: Cache kết quả extract (in-memory) + single-flight

Plan: [`plans/08_extract_cache.md`](../../plans/08_extract_cache.md)

Branch đề xuất: `feat/extract-cache`

## Tóm tắt

Cache `extractQuery` (ParsedQuery) in-memory theo `q` + vocab signature, để cùng câu hỏi không gọi
lại Gemini — xử ca bật/tắt vị trí (re-fetch cùng `q`) và lỗi "high demand" do trùng lặp/đông người.
Kèm single-flight gộp request trùng đang bay. Server-side, trong suốt với client; không DB, không
route/UI mới, không dependency.

Quyết định đã chốt: **in-memory** (không Redis lần này); **cache + single-flight** (không retry);
`CACHE_MAX=1000`, `CACHE_TTL_MS=6h` (tunable); key gồm **vocabSig**; **chỉ cache khi Gemini thành công**.

## Checklist (theo thứ tự phụ thuộc)

- [x] `01_extract_cache_lib.md` — `extractCache.ts` (LRU + TTL + single-flight + `buildKey` + `_reset`) + unit test thuần (`5667f4f`)
- [x] `02_integrate_extract.md` — bọc `extractQuery` qua cache (compute trả `null` khi fail); test caching mock `@google/genai` (`55d7a74`)
- [x] `03_finalize.md` — `pnpm lint && pnpm test && pnpm build` xanh; PR: chờ user xác nhận push

## MUST nhắc lại (AGENTS.md)

- **YAGNI/KISS**: cache nhỏ gọn, không abstraction đầu cơ (không tạo lớp backend Redis lúc chưa cần).
- **Validate-at-the-edge**: route `/api/search` không đổi; vẫn validate `q`/`lat`/`lng` như cũ.
- **Edge/AI cost**: đây chính là tối ưu cost/độ tin Gemini — chỉ cache kết quả THÀNH CÔNG, lỗi không cache.
- **File ≤300 LOC**, tách theo concern (cache util tách khỏi `extract.ts`).
- **Server-first**: cache sống ở lib server; không lộ ra client, không `"use client"`.
- Không Drizzle/ORM, không Pool mới (feature này không chạm DB).

## Ghi chú khi làm theo task

- Mỗi task: commit code → thêm `## Commit <hash>` vào file task + tick `00_overview.md` → commit
  docs-link riêng (xem memory `task-commit-link-workflow`).
