# 06 — Finalize: preview light/dark + lint/test/build + PR

> Guardrails ✅: `pnpm lint && pnpm test (108) && pnpm build` xanh; audit không palette/hex, file lớn nhất
> `OrderForm` 231 LOC (<300); `mock.ts`/dev stepper có ghi chú "tạm". Routes `/orders`, `/orders/[id]`,
> `/orders/2002` smoke-test HTTP 200. Preview mắt thường light/dark: do người dùng chốt trên `pnpm dev`.

## Vì sao
Chốt phần UI để có bản preview ổn cho việc tinh chỉnh và làm nền nối backend (plan 10).

## Việc
- **Preview thủ công (`pnpm dev`):**
  - Mở quán → "Đặt món" → đặt thử cả delivery & pickup (mock) → sang `/orders/[id]`.
  - Dùng dev stepper duyệt mọi trạng thái; kiểm timeline, badge, nút Huỷ/Đã nhận đúng từng state.
  - Kiểm **light + dark** (đổi theme hệ điều hành) cho mọi màn hình mới.
- **Guardrails:**
  - `pnpm lint && pnpm test && pnpm build` (từ `app/`) xanh.
  - Soát: màn hình mới chỉ dùng **semantic token** (không `bg-zinc-*`/hex mới); server-first chỗ
    nào được; không file nào vượt ~300 LOC chưa tách concern; `mock.ts`/dev stepper có ghi chú "tạm".
- **PR:** branch `feat/buyer-order-ui` → `main`. Mô tả: UI-first mock, danh sách màn hình, các
  quyết định mặc định (mock-only, semantic token mới, vào form từ RestaurantModal), và nêu rõ
  bước sau là nối plan 10. Conventional commits, **không reference AI**.

## Done khi
- Toàn luồng buyer xem/đặt (mock) chạy mượt, duyệt được mọi trạng thái ở light + dark.
- `pnpm lint && pnpm test && pnpm build` xanh.
- PR mở, mô tả đầy đủ; checklist `00_overview.md` tick hết.
