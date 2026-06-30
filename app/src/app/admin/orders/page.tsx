// Dashboard đơn cho seller (plan 10). Server component: đọc đơn thật của quán seller quản lý,
// nhóm theo trạng thái, lọc theo quán. Realtime qua SellerOrdersRefresher (SSE → router.refresh).

import Link from "next/link";
import { getCurrentUser, listEditableRestaurants } from "@/lib/authz";
import { listOrdersForSeller } from "@/lib/orders/repo";
import { groupSellerOrders } from "@/lib/orders/sellerActions";
import { SellerOrderRow } from "@/components/admin/SellerOrderRow";
import { SellerOrdersRefresher } from "@/components/admin/SellerOrdersRefresher";
import type { Order } from "@/lib/orders/types";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const sp = await searchParams;
  // Validate-at-the-edge: chỉ nhận id số; rỗng/không hợp lệ = tất cả quán.
  const restaurantId =
    typeof sp.restaurant === "string" && /^\d+$/.test(sp.restaurant)
      ? Number(sp.restaurant)
      : undefined;

  const user = (await getCurrentUser())!; // admin/layout đã đảm bảo đăng nhập + role
  const orders = await listOrdersForSeller(user, restaurantId);
  const { needsAction, inProgress, done } = groupSellerOrders(orders);
  const restaurants = await listEditableRestaurants(user, "");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col p-6">
      <SellerOrdersRefresher />
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Quản lý đơn</h1>
        <Link href="/admin" className="text-sm text-muted-foreground underline">
          ← Về quán
        </Link>
      </header>

      {/* Lọc theo quán — server-first (GET form, không client JS) */}
      <form method="get" className="mb-6 flex gap-2">
        <select
          name="restaurant"
          defaultValue={restaurantId ? String(restaurantId) : ""}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
        >
          <option value="">Tất cả quán</option>
          {restaurants.map((r) => (
            <option key={r.id} value={String(r.id)}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted"
        >
          Lọc
        </button>
      </form>

      <Section title="Cần xử lý" orders={needsAction} emptyText="Không có đơn chờ xác nhận." tone="alert" />
      <Section title="Đang làm" orders={inProgress} emptyText="Không có đơn đang xử lý." tone="warn" />
      <Section title="Hoàn tất · Huỷ" orders={done} emptyText="Chưa có đơn kết thúc." tone="muted" />
    </main>
  );
}

function Section({
  title,
  orders,
  emptyText,
  tone = "muted",
}: {
  title: string;
  orders: Order[];
  emptyText: string;
  // alert (đỏ — cần xử lý) | warn (cam — đang làm) | muted (chỉ đếm trong ngoặc).
  tone?: "alert" | "warn" | "muted";
}) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {title}
        {orders.length > 0 &&
          (tone === "muted" ? (
            <span className="text-muted-foreground">({orders.length})</span>
          ) : (
            <span
              className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium text-brand-foreground ${
                tone === "alert" ? "bg-danger" : "bg-brand"
              }`}
            >
              {orders.length}
            </span>
          ))}
      </h2>
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <SellerOrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </section>
  );
}
