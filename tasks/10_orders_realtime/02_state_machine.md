# 02 — Máy trạng thái đơn (logic thuần)

## Vì sao
Quy tắc chuyển trạng thái + ai được phép chuyển (buyer/seller) là logic dễ sai và cần test kỹ.
Tách thành hàm **thuần, không chạm DB** để unit test không cần Postgres (§6) và để route/repo
dùng lại làm guard trước khi ghi. Đây là **nguồn sự thật transition** mà UI helper bám theo.

## Việc
- Tạo `app/src/lib/orders/state.ts`:
  - **Tái dùng** `Fulfillment`/`OrderStatus` từ `app/src/lib/orders/types.ts` (đã có — KHÔNG định
    nghĩa lại).
  - `ORDER_TRANSITIONS`: từ trạng thái → tập trạng thái kế hợp lệ, **phân nhánh theo fulfillment**:
    - `pending → accepted | rejected | cancelled`
    - `accepted →` `delivering` (delivery) **hoặc** `ready` (pickup) `| cancelled`
    - `delivering → arrived`; `arrived → completed`; `ready → completed`
    - terminal (không đi tiếp): `completed`, `rejected`, `cancelled`
  - `canTransition(fulfillment, from, to): boolean`.
  - `allowedActors(to): Set<'buyer' | 'seller'>` — seller: `accepted/rejected/delivering/arrived/ready`;
    buyer: `cancelled`; **`completed`: cả hai** (buyer "Đã nhận hàng" / seller "Hoàn tất").
  - (tuỳ chọn) `nextStatusesFor(fulfillment, from)` để UI render nút hợp lệ.
- Tạo `app/src/lib/orders/state.test.ts` (Vitest) cạnh bên:
  - phủ mọi cặp hợp lệ + vài cặp không hợp lệ cho cả delivery & pickup
  - pickup KHÔNG cho `accepted → delivering`; delivery KHÔNG cho `accepted → ready`
  - `allowedActors` đúng cho từng trạng thái (gồm `completed` chứa **cả** buyer & seller).

## Done khi
- `pnpm test` (từ `app/`) xanh, `state.test.ts` chạy được không cần DB.
- File chỉ chứa logic thuần (không import `db`/`auth`); dùng kiểu từ `types.ts`.
