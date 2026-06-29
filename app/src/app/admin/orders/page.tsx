// Dashboard đơn cho seller (feature 13 — mock). Server component: đọc mock, lọc theo quán, nhóm
// theo trạng thái. Quyền đã guard ở admin/layout.tsx. Plan 10 thay mock bằng đơn thật của quán canEdit.

import Link from "next/link";
import { SellerOrderRow } from "@/components/admin/SellerOrderRow";
import { listMockOrders, restaurantNames } from "@/lib/orders/mock";
import { groupSellerOrders } from "@/lib/orders/sellerActions";
import type { Order } from "@/lib/orders/types";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const sp = await searchParams;
  // Validate-at-the-edge: chỉ nhận chuỗi; rỗng = tất cả quán.
  const restaurant = typeof sp.restaurant === "string" ? sp.restaurant.trim() : "";

  const all = listMockOrders();
  const filtered = restaurant
    ? all.filter((o) => o.restaurantName === restaurant)
    : all;
  const { needsAction, inProgress, done } = groupSellerOrders(filtered);
  const restaurants = restaurantNames(all);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col p-6">
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
          defaultValue={restaurant}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
        >
          <option value="">Tất cả quán</option>
          {restaurants.map((name) => (
            <option key={name} value={name}>
              {name}
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

      <Section title="Cần xử lý" orders={needsAction} emptyText="Không có đơn chờ xác nhận." urgent />
      <Section title="Đang làm" orders={inProgress} emptyText="Không có đơn đang xử lý." />
      <Section title="Hoàn tất · Huỷ" orders={done} emptyText="Chưa có đơn kết thúc." />
    </main>
  );
}

function Section({
  title,
  orders,
  emptyText,
  urgent = false,
}: {
  title: string;
  orders: Order[];
  emptyText: string;
  urgent?: boolean;
}) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {title}
        {orders.length > 0 &&
          (urgent ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-medium text-brand-foreground">
              {orders.length}
            </span>
          ) : (
            <span className="text-muted-foreground">({orders.length})</span>
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
