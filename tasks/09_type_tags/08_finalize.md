# 08 — Finalize: lint/test/build + PR

> `edfd72f` — refactor(search): xoá type FoodCategory; lint+test(101)+build xanh ✅

## Vì sao
Chốt feature: đảm bảo xanh toàn bộ trước khi mở PR (AGENTS §7).

## Việc
- Trong `app/`: `pnpm lint && pnpm test && pnpm build` — phải xanh.
- Soát lại không còn tham chiếu `category` (ParsedQuery), `FoodCategory`, `MenuKind`,
  `serves_food`/`serves_drink`, `mc.kind` trong code app.
- Mở PR `feat/category-to-type-tags` → `main`. Mô tả: đổi food/drink từ trục cứng sang type-tag mềm;
  nêu rõ task 07 (DROP cột) phải apply sau khi deploy.
- Conventional commit, **không reference AI**.

## Done khi
- 3 lệnh xanh; PR mở; checklist `00_overview.md` tick đủ.
