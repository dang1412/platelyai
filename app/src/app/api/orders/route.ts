import type { NextRequest } from "next/server";
import { getCurrentUser, AuthzError, authzResponse } from "@/lib/authz";
import { validationResponse } from "@/lib/adminValidate";
import { parseCreateOrder } from "@/lib/orderValidate";
import { createOrder, listOrdersForBuyer } from "@/lib/orders/repo";

export const runtime = "nodejs";

// POST /api/orders — buyer (đã đăng nhập) tạo đơn. Giá lấy server-side trong repo.createOrder.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");

    const body = await request.json().catch(() => ({}));
    const input = parseCreateOrder(body);
    const order = await createOrder(user.id, input);
    return Response.json({ id: order.id, order }, { status: 201 });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}

// GET /api/orders — danh sách đơn của buyer hiện tại (trang /orders).
export async function GET(): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");
    const orders = await listOrdersForBuyer(user.id);
    return Response.json({ orders });
  } catch (err) {
    return authzResponse(err) ?? Response.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
