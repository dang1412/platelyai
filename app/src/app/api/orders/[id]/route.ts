import { getCurrentUser, AuthzError, authzResponse } from "@/lib/authz";
import { requireIntId, validationResponse } from "@/lib/adminValidate";
import { getOrderAuth, getOrderFull } from "@/lib/orders/repo";
import { canViewOrder } from "@/lib/orders/authz";

export const runtime = "nodejs";

// GET /api/orders/:id — chi tiết 1 đơn (buyer của đơn / seller của quán / admin).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");

    const id = requireIntId((await params).id);
    const auth = await getOrderAuth(id);
    if (!auth) throw new AuthzError(404, "Không tìm thấy đơn");
    if (!(await canViewOrder(user, auth))) {
      throw new AuthzError(403, "Không có quyền xem đơn này");
    }

    const order = await getOrderFull(id);
    return Response.json({ order });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
