// Cập nhật realtime cho dashboard đơn seller (server component): nghe SSE → router.refresh() để
// chạy lại server component (đơn mới / đổi trạng thái hiện ra không cần reload tay).

"use client";

import { useRouter } from "next/navigation";
import { useOrderStream } from "@/lib/useOrderStream";

export function SellerOrdersRefresher() {
  const router = useRouter();
  useOrderStream(() => router.refresh());
  return null;
}
