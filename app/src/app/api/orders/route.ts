import type { NextRequest } from "next/server";
import { getCurrentUser, AuthzError, authzResponse } from "@/lib/authz";
import { validationResponse } from "@/lib/adminValidate";
import { parseCreateOrder } from "@/lib/orderValidate";
import {
  createOrder,
  listOrdersForBuyer,
  activeCountForBuyer,
} from "@/lib/orders/repo";

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
//   ?count=active → { activeCount } (badge side menu — chỉ COUNT, không nạp items/events).
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");

    if (request.nextUrl.searchParams.get("count") === "active") {
      return Response.json({ activeCount: await activeCountForBuyer(user.id) });
    }
    const orders = await listOrdersForBuyer(user.id);
    return Response.json({ orders });
  } catch (err) {
    return authzResponse(err) ?? Response.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
