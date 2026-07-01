# 18 — Toast notification + báo lỗi server khi API fail

## Mục tiêu
Thêm hệ thống **toast notification** toàn app (client-side) để hiển thị thông báo ngắn ở góc màn
hình. Trọng tâm: khi một API request fail, tự đọc message lỗi từ server (`{ error }`) và bắn toast
đỏ, thay cho việc hiện tại mỗi component tự xử lý rời rạc (chỗ hiện inline `<p>`, chỗ nuốt lỗi im
lặng như `FavoriteButton`, `SellerActionPanel`).

Không có route/màn hình mới — đây là hạ tầng UI dùng chung, mount ở root.

## Phạm vi & quyết định mặc định
- **Tự dựng, không thêm dependency** (KISS, bám convention project tự dựng UI). ~context + provider +
  component, dùng semantic token sẵn có (`--danger`, `--success`, `--surface`, `--border`).
- **Trigger lỗi qua fetch wrapper dùng chung** `apiFetch()`: request fail → tự đọc `{ error }` →
  bắn toast lỗi. Component vẫn nhận `Response` để xử lý tiếp (rollback optimistic…).
- Toast có 3 loại: `error` (mặc định cho fail), `success`, `info`. Auto-dismiss ~4s + nút đóng.
- **Không persist, không queue phía server, không realtime** — thuần client, ephemeral. (Toast cho
  event realtime đơn hàng = mở rộng ngoài scope.)

## Luồng
```
Component
  │  await apiFetch("/api/orders", { method:"POST", body })   ← thay fetch()
  ▼
apiFetch (src/lib/apiFetch.ts, client)
  │  fetch() thật
  │  res.ok? ──yes──► trả Response cho caller (không toast)
  │        └─no──► đọc body {error} (fallback msg mặc định) ──► emitToast(error)
  │  network throw ──► emitToast("Lỗi mạng…") ──► rethrow (caller tự finally)
  ▼
ToastBus (module-level emitter, không phụ thuộc React)
  ▼
ToastProvider ("use client", mount trong Providers)  ──►  ToastViewport (fixed góc phải-dưới)
```
Ranh giới: **toàn bộ client**. Không chạm DB/AI. Server không đổi (đã trả `{ error }` sẵn ở các
route — xem `InfoForm`/`OrderForm`/`profile` đã đọc `data.error`).

## Backend
Không có thay đổi server bắt buộc. Chỉ **rà soát** để chắc các route trả lỗi dạng
`{ error: string }` với status ≥400 (đa số đã đúng). Nếu thấy route trả lỗi không có field `error`
→ ghi chú, không sửa trong plan này trừ khi trivial.

## Frontend
| File | Vai trò |
| --- | --- |
| `src/lib/toast/types.ts` | Type `Toast`, `ToastKind`, `ToastInput`. |
| `src/lib/toast/bus.ts` | Emitter module-level (subscribe/emit) để `apiFetch` bắn toast **ngoài** cây React. |
| `src/components/toast/ToastProvider.tsx` | `"use client"` — subscribe bus, giữ mảng toast trong state, cung cấp context + render viewport. Auto-dismiss bằng timer. |
| `src/components/toast/ToastViewport.tsx` | Render danh sách toast, `fixed` góc phải-dưới, `role="status"`/`aria-live`, nút đóng. Token: `bg-surface`, `border`, `text-danger`/`text-success`. |
| `src/lib/toast/useToast.ts` | Hook `useToast()` → `{ toast, success, error, info }` cho trường hợp gọi thủ công (ngoài fetch fail). |
| `src/lib/apiFetch.ts` | Wrapper `apiFetch(input, init?, opts?)`. Fail → emit toast lỗi (đọc `{error}`), trả `Response`. `opts.silent` để tắt auto-toast khi caller muốn tự xử lý. |

Server-first: chỉ các file toast + Providers là client. Mount `ToastProvider` **bên trong**
`Providers.tsx` (đã `"use client"`, đã ở root layout) — không đụng `layout.tsx`.

Dark mode: dùng token nên tự chạy cả light + dark; kiểm mắt thường 2 chế độ.

## Schema
Không có thay đổi DB.

## Refactor call-site (từng bước, additive)
Sau khi hạ tầng xong, đổi các `fetch("/api/…")` phía client sang `apiFetch(…)` để hưởng auto-toast.
Ưu tiên nơi đang nuốt lỗi im lặng: `FavoriteButton`, `SellerActionPanel`, `OrderTracker`. Nơi đã có
inline error (`InfoForm`, `OrderForm`, `profile`) → chuyển dần, có thể giữ inline + thêm toast tuỳ
UX (mặc định: giữ inline cho lỗi validate tại form, dùng toast cho lỗi mạng/500).

## Bảng file đụng tới
| File | Loại |
| --- | --- |
| `src/lib/toast/types.ts` | mới |
| `src/lib/toast/bus.ts` | mới |
| `src/lib/toast/bus.test.ts` | mới (unit) |
| `src/lib/toast/useToast.ts` | mới |
| `src/lib/apiFetch.ts` | mới |
| `src/lib/apiFetch.test.ts` | mới (unit, mock fetch) |
| `src/components/toast/ToastProvider.tsx` | mới |
| `src/components/toast/ToastViewport.tsx` | mới |
| `src/components/Providers.tsx` | sửa (bọc ToastProvider) |
| `FavoriteButton.tsx`, `admin/SellerActionPanel.tsx`, `OrderTracker.tsx`, … | sửa (fetch→apiFetch) |

## Test & guardrails
- **Unit (Vitest, cạnh nguồn):**
  - `bus.test.ts`: subscribe nhận được emit, unsubscribe thì không, nhiều subscriber.
  - `apiFetch.test.ts`: mock `fetch` — `res.ok` → không emit; status 400 có `{error}` → emit đúng
    message; body không parse được → emit message mặc định; network throw → emit + rethrow;
    `opts.silent` → không emit.
- Component toast là UI thuần client, không cần integration DB.
- Guardrails AGENTS: chỉ token semantic (không hex/`zinc`/`gray`), file ≤200 LOC, `"use client"`
  chỉ ở component cần, không chạm SQL.

## Mở rộng ngoài scope
- Toast cho event realtime (đơn hàng đổi trạng thái) — nối vào `useOrderStream`.
- Toast action (nút "Hoàn tác"), stacking nâng cao, animation phức tạp.
- Chuyển toàn bộ inline error sang toast (làm dần, không ép trong plan này).
