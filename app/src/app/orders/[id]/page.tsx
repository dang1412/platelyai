// Trang theo dõi đơn buyer (plan 10). Khung server-first; OrderTracker tự fetch đơn thật + SSE.
// Next 16: params là Promise — phải await.

import { OrderTracker } from "@/components/OrderTracker";
import SiteHeader from "@/components/SiteHeader";

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-lg px-5 py-8">
      <SiteHeader />
      <OrderTracker id={id} />
    </main>
  );
}
