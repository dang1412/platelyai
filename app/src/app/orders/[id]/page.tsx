// Trang theo dõi đơn buyer (feature 11 — mock). Khung server-first; phần tương tác ở OrderTracker.
// Next 16: params là Promise — phải await.

import { getMockOrder } from "@/lib/orders/mock";
import { OrderTracker } from "@/components/OrderTracker";
import SiteHeader from "@/components/SiteHeader";

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = getMockOrder(id);

  return (
    <main className="mx-auto max-w-lg px-5 py-8">
      <SiteHeader />
      <OrderTracker id={id} initialOrder={order} />
    </main>
  );
}
