// Chi tiết 1 đơn cho seller (feature 13 — mock). Server đọc mock; phần thao tác ở SellerActionPanel.
// Next 16: params là Promise — phải await. Quyền đã guard ở admin/layout.tsx.

import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderSummary } from "@/components/OrderSummary";
import { SellerActionPanel } from "@/components/admin/SellerActionPanel";
import { getMockOrder } from "@/lib/orders/mock";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Validate-at-the-edge: id phải là chuỗi không rỗng.
  if (!id.trim()) notFound();
  const order = getMockOrder(id);
  if (!order) notFound();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">
          {order.restaurantName}
        </h1>
        <Link
          href="/admin/orders"
          className="text-sm text-muted-foreground underline"
        >
          ← Về danh sách
        </Link>
      </header>

      <SellerActionPanel initialOrder={order} />

      <OrderSummary
        items={order.items}
        total={order.total}
        fulfillment={order.fulfillment}
        phone={order.phone}
        address={order.address}
      />

      {order.note && (
        <p className="text-sm text-muted-foreground">Ghi chú: {order.note}</p>
      )}
    </main>
  );
}
