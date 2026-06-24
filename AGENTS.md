# platelyai — Agent & Contributor Rules

> Đối tượng: dev + Claude Code + bất kỳ AI agent nào mở repo này.
> Mục tiêu: code cùng một hình dạng, đúng chỗ, đúng convention.
>
> **Cách đọc:** phần lớn rule là **default có escape hatch**, không phải tuyệt đối. Rule không có escape hatch (security, correctness) ghi rõ "MUST" / "Never". Còn lại: có lý do hợp lý thì cứ lệch, và note "why" trong PR/commit.

## 1. Project facts cần nắm

- **Stack:** Next.js 16 (App Router, RSC) + React 19 + TypeScript + Tailwind v4 (PostCSS, `@theme` trong `globals.css` — **không có file JS config**).
- **Monorepo nhẹ:** web app nằm trong `app/` (có `pnpm-workspace.yaml`). Mọi lệnh `pnpm dev|build|lint|test` chạy từ `app/`.
- **DB:** PostgreSQL 16 + **PostGIS** (geo) + **pgvector** (semantic). **SQL viết tay qua `pg`** — đã bỏ Drizzle có chủ đích (xem `plans/01_*`). Mọi query đi qua helper `query()` trong `app/src/lib/db.ts`. Schema khởi tạo ở `db/init/*.sql`, chạy qua `docker compose up`.
- **AI:** Gemini (`@google/genai`) hiểu query + OpenAI embeddings để semantic match món.
- **Auth:** NextAuth v5 (beta), route `app/src/app/api/auth/[...nextauth]/route.ts`.
- **Test:** Vitest, file `*.test.ts` đặt **cạnh** file nguồn trong `src/lib/`.
- **Ngôn ngữ:** sản phẩm tiếng Việt, một ngôn ngữ — **không có i18n**. Comment trong code viết tiếng Việt theo convention hiện tại.

## 2. Read-before-write (MUST)

**Đây là Next.js 16 — không phải bản trong training data của bạn.** APIs/conventions/file structure có thể khác. Trước khi viết code Next.js, mở doc đúng version đang cài:

| Topic | Path |
| --- | --- |
| App Router file conventions | `app/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/` |
| Route handlers | `.../03-file-conventions/route.md` |
| Proxy (trước là middleware) | `.../03-file-conventions/proxy.md` |
| Server actions / forms | `app/node_modules/next/dist/docs/01-app/02-guides/forms.md` |

Bỏ qua bước đọc nếu thay đổi thuần cosmetic (copy, tweak Tailwind) HOẶC đã đọc trong session này. Khi phân vân → đọc trước.

**Cheatsheet Next 16 deltas** (ghi thêm mỗi khi phát hiện một cái mới):
- `middleware.ts` → `proxy.ts` (tên hàm `proxy`, vẫn dùng `config.matcher`).
- `useSearchParams()` trong page → phải bọc `<Suspense>` để prerender.
- Route params là async — `params` trong route/page là `Promise`, phải `await`.

## 3. Code rules (enforced)

- **YAGNI / KISS / DRY.** Không abstraction đầu cơ, không feature flag cho code có thể xoá thẳng.
- **File size:** target ≤200 LOC, refactor khi vượt 300, hard limit 400. **Split theo *concern*, không theo số dòng** — ba file 70 dòng logic chồng chéo tệ hơn một file 210 dòng làm một việc rõ ràng.
- **Filename:** theo convention hàng xóm trong cùng thư mục (hiện tại lib dùng lowercase/camelCase: `candidates.ts`, `db.ts`, hook `useSpeechInput.ts`). Đừng đổi sang style lạ. Tên Next.js conventional (`page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`, `not-found.tsx`) giữ nguyên.
- **Server-first.** Default RSC. Chỉ thêm `"use client"` khi cần state / effect / browser API.
- **Validate at the edge (MUST):** mọi route handler + server action validate input **trước khi** chạm DB hoặc gọi AI (parse `searchParams`/body, ép kiểu, chặn giá trị ngoài range). Hiện validate viết tay; nếu thêm thư viện, ưu tiên Zod và làm nhất quán.
- **SQL an toàn (MUST):** chỉ query qua helper `query()` trong `src/lib/db.ts`, **luôn tham số hoá `$1, $2…`**. **Never** nội suy chuỗi vào SQL (`` `WHERE name='${x}'` ``) — nguồn gốc SQL injection. Không tạo `Pool` mới ở chỗ khác; tái dùng pool đã export.
- **Edge/AI cost:** gọi Gemini/OpenAI là tốn tiền + chậm — cache khi hợp lý (xem `loadTagVocab` cache), đừng gọi trong vòng lặp render.

## 4. Database & migrations

> Dev hiện chạy Postgres trong Docker (`docker-compose.yml`), schema seed từ `db/init/*.sql`.

- **Schema change phải additive.** Thêm column/table/index thoải mái. `DROP`/`RENAME`/thu hẹp kiểu → chỉ qua 2 bước (1: thêm mới + ghi cả hai, 2: backfill + bỏ cũ). Không sửa file `db/init/*.sql` đã apply trên DB có dữ liệu thật; thêm file SQL mới đánh số kế tiếp.
- **PostGIS/pgvector:** query geo dùng index không gian; query vector (`<=>`) cần index pgvector — đừng làm full scan trên bảng lớn.
- `.env` chứa `DATABASE_URL` — **gitignored**, chỉ commit `.env.example`. **Never** commit `.env*` (trừ `.env.example`).

## 5. Design tokens (UI)

> Single source of truth: `app/src/app/globals.css` (`@theme` block, Tailwind v4 — không có JS config).

**Default (có escape hatch — note "why" nếu lệch):**
- **Không raw hex/rgb trong JSX/TSX.** Dùng semantic token (`bg-background`, `text-foreground`…). Thiếu token thì thêm vào `@theme` (cả light + dark) rồi mới dùng.
- **Không palette literal** (`bg-zinc-900`, `text-gray-700`) khi đã có/ có thể có semantic token.
- Spacing/typography/radius/shadow theo scale Tailwind, tránh `p-[13px]`, `text-[15px]` (ngoại lệ: border 1px).
- **Dark mode:** mọi screen mới phải chạy được ở cả light + dark (project đã có `prefers-color-scheme: dark` trong globals).

## 6. Tests

- Vitest, `pnpm test` (từ `app/`). File test đặt cạnh nguồn: `src/lib/rank.ts` → `src/lib/rank.test.ts`.
- **Integration test chạm DB phải hit Postgres thật (test DB)** — không mock che giấu rủi ro schema/SQL.
- Logic thuần (rank, extract, synonyms…) → unit test không cần DB.

## 7. Git / commit / PR

- Branch off `main` (không có branch `dev`): `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `refactor/<slug>`. Merge về `main` qua PR.
- **Conventional commits:** `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `ci:`. **Không reference AI trong commit message.**
- Trước khi mở PR: `pnpm lint && pnpm test && pnpm build` (chạy trong `app/`) phải xanh.
- **Never** commit `.env*` (trừ `.env.example`).

## 8. Where to put new files

| What | Path |
| --- | --- |
| Plan / thiết kế tính năng | `plans/NN_<slug>.md` |
| Route page | `app/src/app/<route>/page.tsx` |
| API route | `app/src/app/api/<name>/route.ts` |
| Domain/logic thuần | `app/src/lib/<name>.ts` (+ `<name>.test.ts` cạnh bên) |
| Component | `app/src/components/<name>.tsx` |
| Hook | `app/src/hooks/` hoặc `src/lib/use<Name>.ts` (theo convention hiện tại) |
| Type dùng chung | `app/src/types/` hoặc `app/src/lib/types.ts` |
| DB schema/seed | `db/init/NN_<slug>.sql` |

Cần folder top-level mới → hỏi trước.

## 9. AI agent checklist (khi sinh/sửa code)

Agent MUST:
1. Đọc doc Next 16 đúng version (§2) trước khi viết code Next.js — đừng tin trí nhớ.
2. Nếu nội suy biến vào chuỗi SQL thay vì `$1` param → **reject và viết lại** với tham số hoá qua `query()`.
3. Nếu đề xuất `middleware.ts` → sửa thành `proxy.ts`. Nếu đề xuất thêm Drizzle/ORM → reject (project cố ý dùng `pg` thuần).
4. Nếu sinh raw hex / `bg-zinc-*` / `text-gray-*` / `[13px]` → reject, dùng token từ `globals.css`.
5. Nếu skip validate input ở route/server action → reject.
6. Nếu tạo file vượt 300 LOC mà chưa tách concern → cân nhắc tách trước khi kết thúc.
