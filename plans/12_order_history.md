# 12 — Trang lịch sử đơn (order history, mock) + link side menu

## Mục tiêu
Nâng cấp trang `/orders` (đã có từ feature 11) thành **trang lịch sử đơn** dùng **mock data**,
tách 2 nhóm **Đang xử lý** / **Lịch sử**, và thêm **link "Đơn của tôi"** vào side menu trong
`AuthButton` — chỉ hiện khi đã đăng nhập. Vẫn **mock-only**, không chạm DB/AI/route (nối backend
là việc plan [`10_orders_realtime`](10_orders_realtime.md)).

Màn hình: `/orders` (nâng cấp tại chỗ, không tạo route mới — KISS/DRY).

## Quyết định mặc định (chỉnh được)
- **Tái dùng `/orders`** đã có thay vì tạo `/orders/history` — tránh hai trang trùng mục đích.
- **Tách nhóm theo trạng thái**: *Đang xử lý* = `pending, accepted, delivering, arrived, ready`;
  *Lịch sử* = `completed, cancelled, rejected`. Mỗi nhóm sắp xếp **mới nhất trước** (theo `createdAt`).
- **Phân nhóm là logic thuần** đặt ở `lib/orders/statusMeta.ts` (đã chứa `statusTone`/`flowFor`) +
  unit test cạnh bên — **không** nhét vào component.
- **Link side menu** trỏ `/orders`, nhãn "Đơn của tôi", hiện cho **mọi user đã đăng nhập** (đặt
  trên link admin). Mock nên chưa lọc theo user thật.
- Tái dùng `OrderCard` sẵn có; chỉ thêm tiêu đề nhóm + empty state. Không tạo component mới trừ
  khi page vượt ~200 LOC.

## Luồng (toàn bộ client, dữ liệu mock — KHÔNG chạm DB/AI)

```
Side menu (AuthButton, đã login) ──[Đơn của tôi]──► /orders
                                                       │
   listMockOrders() ──► groupOrders() ─┬─ Đang xử lý ─► OrderCard… ─► /orders/[id]
   (lib, thuần)         (lib, thuần)   └─ Lịch sử ─────► OrderCard…
```

Ranh giới: tất cả ở client + lib thuần. Không route handler, không SQL, không AI.

## Backend (chỉ lib thuần, KHÔNG route/DB)
- `app/src/lib/orders/statusMeta.ts` — thêm:
  - `isActiveStatus(status): boolean` — `true` cho nhóm đang xử lý (dựa trên `statusTone`/danh sách
    terminal đã có, không lặp lại hằng số rời rạc).
  - `groupOrders(orders): { active: Order[]; history: Order[] }` — chia 2 nhóm, mỗi nhóm sort
    `createdAt` desc. Thuần, không side effect.
- `app/src/lib/orders/statusMeta.test.ts` — bổ sung case cho `isActiveStatus` (mỗi status) và
  `groupOrders` (chia đúng nhóm + thứ tự desc + mảng rỗng).

## Frontend
- `app/src/app/orders/page.tsx` — nâng cấp:
  - Thêm **header chung** `<SiteHeader />` ở đầu trang (convention: mọi trang buyer-facing dùng
    `SiteHeader`, per-page — xem `app/src/components/SiteHeader.tsx`). `/orders` hiện thiếu header.
  - Gọi `groupOrders(listMockOrders())`, render 2 section có tiêu đề (**Đang xử lý**, **Lịch sử**).
  - **Empty state** cho mỗi nhóm (vd "Chưa có đơn nào đang xử lý"). Ẩn section nếu rỗng *hoặc* hiện
    dòng rỗng nhẹ — chọn: luôn hiện tiêu đề + dòng empty (đơn giản, ổn định layout).
  - Giữ `"use client"` + `useRouter().push("/orders/[id]")` như hiện tại; semantic token
    (`text-foreground`, `text-muted-foreground`, `bg-surface`…), chạy light + dark.
- `app/src/components/AuthButton.tsx` — thêm `<Link href="/orders">Đơn của tôi</Link>` trong `<nav>`,
  **trên** link admin, `onClick={() => setOpen(false)}`, dùng class giống link admin sẵn có. Hiện cho
  mọi `session.user` (không cần điều kiện role).

## Schema
Không. Mock-only, không thêm `db/init/*.sql`.

## Bảng file đụng tới
| File | Việc |
| --- | --- |
| `app/src/lib/orders/statusMeta.ts` | + `isActiveStatus`, `groupOrders` (thuần) |
| `app/src/lib/orders/statusMeta.test.ts` | + test cho 2 helper mới |
| `app/src/app/orders/page.tsx` | nâng cấp: `<SiteHeader />` + 2 nhóm + tiêu đề + empty state |
| `app/src/components/AuthButton.tsx` | + link "Đơn của tôi" trong side menu |

## Test & guardrails
- **Unit (Vitest)**: `isActiveStatus` mọi status, `groupOrders` (phân nhóm, sort desc, rỗng). Không
  DB ở plan này.
- Không thêm route → không có integration DB test.
- `pnpm lint && pnpm test && pnpm build` xanh trước PR.
- Guardrails AGENTS: semantic token (không `bg-zinc-*`/hex mới), server/client đúng chỗ, logic thuần
  tách khỏi component, file ≤200 LOC.

## Mở rộng ngoài scope (không làm ở đây)
- Lọc đơn theo user thật / phân trang / filter theo quán — chờ plan 10 (API thật).
- Migrate component cũ sang semantic token.
- Badge số đơn đang xử lý trên icon menu.
