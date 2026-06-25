import { query } from "@/lib/db";
import { getCurrentUser, authzResponse, AuthzError } from "@/lib/authz";
import { requireIntId, requireText, validationResponse } from "@/lib/adminValidate";

export const runtime = "nodejs";

// POST /api/admin/restaurants/:id/owners -> gán owner cho quán theo email (chỉ admin).
// User phải đã từng đăng nhập (có dòng trong users). Gán xong nâng role 'user' -> 'owner'
// để họ vào được /admin (xem authz: owner chỉ thấy quán mình sở hữu).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const restaurantId = requireIntId(id);

    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");
    if (user.role !== "admin") {
      throw new AuthzError(403, "Chỉ admin được gán chủ quán");
    }

    const body = await request.json().catch(() => ({}));
    const email = requireText(body.email, "Email").toLowerCase();

    const exists = await query(`SELECT 1 FROM restaurants WHERE id = $1 LIMIT 1`, [
      restaurantId,
    ]);
    if (exists.length === 0) {
      return Response.json({ error: "Không tìm thấy quán" }, { status: 404 });
    }

    const users = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (users.length === 0) {
      return Response.json(
        { error: "Email chưa từng đăng nhập hệ thống" },
        { status: 404 },
      );
    }
    const userId = Number(users[0].id);

    await query(
      `INSERT INTO restaurant_owners (restaurant_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [restaurantId, userId],
    );
    await query(`UPDATE users SET role = 'owner' WHERE id = $1 AND role = 'user'`, [
      userId,
    ]);

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
