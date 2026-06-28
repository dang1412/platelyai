# 01 — Semantic token cho UI đặt món

> Commit: `a879e3b` — feat(orders): semantic token + types/statusMeta/mock cho UI buyer ✅

## Vì sao
`globals.css` hiện chỉ có `--background`/`--foreground`; component cũ chép thẳng `bg-zinc-*`,
`bg-orange-*`, `text-amber-*`. Màn hình mới cần token để tuân §5 (không palette literal) và để
**tinh chỉnh nhanh** (đổi 1 token → đổi cả luồng). Đây là nền cho mọi task UI sau.

## Việc
- Sửa `app/src/app/globals.css`: thêm biến trong `:root` + override trong block
  `@media (prefers-color-scheme: dark)`, và map vào `@theme inline` (Tailwind v4, không JS config).
- Bộ token tối thiểu (đặt tên semantic, KHÔNG đặt theo màu cụ thể):
  - `--color-surface` / `--color-surface-muted` — nền card / nền phụ.
  - `--color-border` — viền.
  - `--color-muted-foreground` — chữ phụ (thay cho `text-zinc-500`).
  - `--color-brand` / `--color-brand-foreground` — nhấn hành động chính (cam hiện tại) + chữ trên nền brand.
  - `--color-success` — bước hoàn tất trong timeline (xanh).
  - (đủ dùng; thêm khi thật cần, YAGNI.)
- Chọn giá trị light + dark hợp với tông hiện tại (surface sáng/`#0a0a0a`-ish cho dark; brand ~ orange-600).
- Giữ nguyên `--background`/`--foreground` đang có.

## Done khi
- `pnpm dev`: thêm 1 phần tử thử dùng `bg-surface text-foreground border-border` render đúng ở cả
  light + dark (đổi theme hệ điều hành thấy đổi màu).
- `pnpm build` xanh (Tailwind nhận token mới, class `bg-brand`, `text-muted-foreground`… hợp lệ).
- Không sửa palette của component cũ (ngoài scope).
