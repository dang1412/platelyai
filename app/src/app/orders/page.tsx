// Danh sách đơn buyer (feature 11 — mock). Client để gắn onClick điều hướng; plan 10 nối API.

"use client";

import { useRouter } from "next/navigation";
import { OrderCard } from "@/components/OrderCard";
import { listMockOrders } from "@/lib/orders/mock";

export default function OrdersListPage() {
  const router = useRouter();
  const orders = listMockOrders();

  return (
    <main className="mx-auto max-w-lg px-5 py-8">
      <h1 className="mb-4 text-xl font-bold text-foreground">Đơn của tôi</h1>
      <div className="flex flex-col gap-3">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onClick={() => router.push(`/orders/${order.id}`)}
          />
        ))}
      </div>
    </main>
  );
}
