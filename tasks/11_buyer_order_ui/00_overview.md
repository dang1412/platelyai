# Feature 11 — Giao diện người đặt món (UI-first, mock)

Plan: [`plans/11_buyer_order_ui.md`](../../plans/11_buyer_order_ui.md)

Branch đề xuất: `feat/buyer-order-ui`

## Tóm tắt
Dựng trước toàn bộ UI buyer (form đặt món + trang theo dõi `/orders/[id]`) bằng **mock data**,
tách presentational component khỏi nguồn dữ liệu để **tinh chỉnh UI/UX** trước khi nối backend
(plan 10). Thêm lớp **semantic token** vào `globals.css` rồi dùng token cho màn hình mới. Không
đụng DB/AI/route ở bước này.

Trạng thái (bám plan 10): delivery `pending→accepted→delivering→arrived→completed`;
pickup `pending→accepted→ready→completed`; `cancelled`/`rejected`.

## Checklist (theo thứ tự phụ thuộc)
- [x] [01_design_tokens.md](01_design_tokens.md) — thêm semantic token vào `globals.css` (light+dark)
- [x] [02_types_meta_mock.md](02_types_meta_mock.md) — `lib/orders/{types,statusMeta(+test),mock}.ts`
- [x] [03_presentational.md](03_presentational.md) — Badge + Timeline + Summary + Card
- [ ] [04_order_form.md](04_order_form.md) — `OrderForm` + nút "Đặt món" trong `RestaurantModal`
- [ ] [05_tracking_page.md](05_tracking_page.md) — `/orders/[id]` (+ tuỳ chọn `/orders`) nối mock + dev stepper
- [ ] [06_finalize.md](06_finalize.md) — lint/test/build + preview light+dark + PR

## MUST nhắc lại (AGENTS)
- **Semantic token** ở màn hình mới — không `bg-zinc-*`/`text-gray-*`/hex mới (§5, agent rule #4).
  Thiếu token → thêm vào `@theme` (cả light + dark) rồi mới dùng.
- **Server-first**; chỉ `"use client"` khi cần state/effect/browser API.
- Spacing/typography/radius theo scale Tailwind (tránh `[13px]`); chạy được **light + dark**.
- Logic thuần (`statusMeta`) **unit test** cạnh file; không DB ở plan này.
- Component tách theo *concern*, target ≤200 LOC.
- Commit: conventional, **không reference AI**. Theo task-commit-link: commit code → thêm dòng
  `> Commit: <hash> — <msg> ✅` vào đầu file task → commit docs-link riêng.
