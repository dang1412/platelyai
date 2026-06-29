import type { NextRequest } from "next/server";
import { getCurrentUser, AuthzError, authzResponse } from "@/lib/authz";
import { requireIntId, validationResponse } from "@/lib/adminValidate";
import { listOrdersForSeller, pendingCountForSeller } from "@/lib/orders/repo";

export const runtime = "nodejs";

// GET /api/seller/orders — đơn của các quán seller quản lý (admin: tất cả).
//   ?restaurant=<id>  lọc theo 1 quán
//   ?count=pending    chỉ trả { pendingCount } (cho badge side menu)
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");
    if (user.role === "user") throw new AuthzError(403, "Không có quyền");

    const sp = request.nextUrl.searchParams;
    if (sp.get("count") === "pending") {
      return Response.json({ pendingCount: await pendingCountForSeller(user) });
    }

    const restaurantParam = sp.get("restaurant");
    const restaurantId = restaurantParam
      ? requireIntId(restaurantParam, "restaurant")
      : undefined;
    const orders = await listOrdersForSeller(user, restaurantId);
    return Response.json({ orders });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
