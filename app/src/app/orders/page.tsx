// Trang lịch sử đơn buyer (plan 10). Tách 2 nhóm Đang xử lý / Lịch sử, dữ liệu từ GET /api/orders.
// Client để fetch + gắn onClick điều hướng.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { OrderCard } from "@/components/OrderCard";
import { useOrderStream } from "@/lib/useOrderStream";
import { groupOrders } from "@/lib/orders/statusMeta";
import type { Order } from "@/lib/orders/types";

export default function OrdersHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);

  // Refetch toàn bộ danh sách (dùng ở mount + khi có event realtime).
  const refetch = () => {
    fetch("/api/orders")
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((d: { orders?: Order[] }) => setOrders(d.orders ?? []))
      .catch(() => setOrders([]));
  };

  useEffect(() => {
    let active = true;
    fetch("/api/orders")
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((d: { orders?: Order[] }) => active && setOrders(d.orders ?? []))
      .catch(() => active && setOrders([]));
    return () => {
      active = false;
    };
  }, []);

  // Realtime: đơn nào của mình đổi trạng thái → refetch để cập nhật nhóm/badge.
  useOrderStream(() => refetch());

  const open = (order: Order) => router.push(`/orders/${order.id}`);
  const groups = orders ? groupOrders(orders) : null;

  return (
    <main className="mx-auto max-w-lg px-5 py-8">
      <SiteHeader />
      <h1 className="mb-6 text-xl font-bold text-foreground">Đơn của tôi</h1>

      {!groups ? (
        <p className="text-sm text-muted-foreground">Đang tải đơn…</p>
      ) : (
        <>
          <Section
            title="Đang xử lý"
            orders={groups.active}
            emptyText="Chưa có đơn đang xử lý."
            onOpen={open}
          />
          <Section
            title="Lịch sử"
            orders={groups.history}
            emptyText="Chưa có đơn nào."
            onOpen={open}
          />
        </>
      )}
    </main>
  );
}

// Một nhóm đơn: tiêu đề + danh sách OrderCard, hoặc dòng rỗng nhẹ khi không có đơn.
function Section({
  title,
  orders,
  emptyText,
  onOpen,
}: {
  title: string;
  orders: Order[];
  emptyText: string;
  onOpen: (order: Order) => void;
}) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onClick={() => onOpen(order)} />
          ))}
        </div>
      )}
    </section>
  );
}
