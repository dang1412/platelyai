import { getCurrentUser, AuthzError, authzResponse } from "@/lib/authz";
import {
  requireIntId,
  optionalText,
  validationResponse,
} from "@/lib/adminValidate";
import { requireOrderStatus } from "@/lib/orderValidate";
import { getOrderAuth, advanceStatus } from "@/lib/orders/repo";
import { assertCanAct } from "@/lib/orders/authz";

export const runtime = "nodejs";

// PATCH /api/orders/:id/status — đẩy trạng thái đơn. body { toStatus, note? }.
// assertCanAct kiểm transition hợp lệ (400) + đúng actor buyer/seller (403).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");

    const id = requireIntId((await params).id);
    const auth = await getOrderAuth(id);
    if (!auth) throw new AuthzError(404, "Không tìm thấy đơn");

    const body = await request.json().catch(() => ({}));
    const toStatus = requireOrderStatus(body.toStatus);
    const note = optionalText(body.note);

    await assertCanAct(user, auth, toStatus);
    const order = await advanceStatus(auth, toStatus, user.id, note ?? undefined);
    return Response.json({ order });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
