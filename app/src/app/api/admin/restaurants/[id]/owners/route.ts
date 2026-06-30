import { query } from "@/lib/db";
import { getCurrentUser, authzResponse, AuthzError } from "@/lib/authz";
import { requireIntId, requireText, validationResponse } from "@/lib/adminValidate";
import {
  assignRestaurantOwner,
  removeRestaurantOwner,
  ownerErrorResponse,
} from "@/lib/owners";

export const runtime = "nodejs";

// Chỉ admin được gán/gỡ chủ quán. Trả về user admin (đã chắc chắn non-null).
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new AuthzError(401, "Chưa đăng nhập");
  if (user.role !== "admin") {
    throw new AuthzError(403, "Chỉ admin được quản lý chủ quán");
  }
  return user;
}

function errorResponse(err: unknown): Response {
  return (
    authzResponse(err) ??
    ownerErrorResponse(err) ??
    validationResponse(err) ??
    Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
  );
}

// POST /api/admin/restaurants/:id/owners -> gán owner cho quán theo email (chỉ admin).
// User phải đã từng đăng nhập (có dòng trong users). Gán xong nâng role 'user' -> 'owner'.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const restaurantId = requireIntId(id);
    await requireAdmin();

    const body = await request.json().catch(() => ({}));
    const email = requireText(body.email, "Email").toLowerCase();

    const exists = await query(`SELECT 1 FROM restaurants WHERE id = $1 LIMIT 1`, [
      restaurantId,
    ]);
    if (exists.length === 0) {
      return Response.json({ error: "Không tìm thấy quán" }, { status: 404 });
    }

    await assignRestaurantOwner(restaurantId, email);

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/admin/restaurants/:id/owners -> gỡ owner khỏi quán theo userId (chỉ admin).
// Idempotent: gỡ dòng không tồn tại vẫn 200. Hết quán thì hạ role owner -> user (xem lib).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const restaurantId = requireIntId(id);
    await requireAdmin();

    const body = await request.json().catch(() => ({}));
    const userId = requireIntId(body.userId, "userId");

    await removeRestaurantOwner(restaurantId, userId);

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
