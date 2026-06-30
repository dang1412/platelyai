// Trang theo dõi đơn buyer (plan 10). Khung server-first; OrderTracker tự fetch đơn thật + SSE.
// Next 16: params là Promise — phải await.

import Link from "next/link";
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
      <Link
        href="/orders"
        className="mb-4 inline-block text-sm text-muted-foreground underline"
      >
        ← Về danh sách đơn
      </Link>
      <OrderTracker id={id} />
    </main>
  );
}
