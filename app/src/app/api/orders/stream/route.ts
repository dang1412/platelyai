import { getCurrentUser } from "@/lib/authz";
import { subscribe, type OrderNotify } from "@/lib/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // SSE: không cache, giữ kết nối mở

// GET /api/orders/stream — Server-Sent Events: đẩy tín hiệu mỏng {orderId,status,…} tới user hiện
// tại khi đơn liên quan đổi trạng thái. Client nhận → refetch (DB là nguồn sự thật). Comment line
// (`: …`) là heartbeat/connected — EventSource bỏ qua, chỉ `data:` mới kích onmessage.
export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Chưa đăng nhập", { status: 401 });

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsub: (() => void) | null = null;

  const cleanup = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (unsub) {
      unsub();
      unsub = null;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (s: string) => {
        try {
          controller.enqueue(encoder.encode(s));
        } catch {
          // controller đã đóng — bỏ qua
        }
      };

      send(`: connected\n\n`);
      unsub = subscribe(user.id, (payload: OrderNotify) => {
        send(`data: ${JSON.stringify(payload)}\n\n`);
      });
      // heartbeat giữ kết nối qua proxy/idle timeout.
      heartbeat = setInterval(() => send(`: ping\n\n`), 25000);

      // client ngắt (đóng tab / mất mạng) → dọn dẹp.
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // đã đóng — bỏ qua
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
