// Chi tiết 1 đơn cho seller (plan 10). Server đọc đơn thật + kiểm quyền; thao tác ở SellerActionPanel.
// Next 16: params là Promise — phải await. Quyền vào /admin đã guard ở admin/layout.tsx.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/authz";
import { getOrderAuth, getOrderFull } from "@/lib/orders/repo";
import { canViewOrder } from "@/lib/orders/authz";
import { OrderSummary } from "@/components/OrderSummary";
import { SellerActionPanel } from "@/components/admin/SellerActionPanel";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Validate-at-the-edge: id phải là số nguyên dương.
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const user = (await getCurrentUser())!;
  const auth = await getOrderAuth(orderId);
  if (!auth || !(await canViewOrder(user, auth))) notFound();
  const order = (await getOrderFull(orderId))!;

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
        lat={order.lat}
        lng={order.lng}
      />

      {order.note && (
        <p className="text-sm text-muted-foreground">Ghi chú: {order.note}</p>
      )}
    </main>
  );
}
