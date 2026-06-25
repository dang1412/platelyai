import { query } from "@/lib/db";
import { getCurrentUser, authzResponse, AuthzError } from "@/lib/authz";
import {
  requireIntId,
  optionalRating,
  optionalCount,
  validationResponse,
} from "@/lib/adminValidate";

export const runtime = "nodejs";

// PATCH /api/admin/restaurants/:id/rating -> sửa điểm + số lượt đánh giá (CHỈ admin).
// Tách khỏi PATCH thông tin quán (owner cũng sửa được) vì rating ảnh hưởng xếp hạng search
// nên chỉ admin được chỉnh.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const restaurantId = requireIntId(id);

    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");
    if (user.role !== "admin") {
      throw new AuthzError(403, "Chỉ admin được sửa đánh giá");
    }

    const body = await request.json().catch(() => ({}));
    const rating = optionalRating(body.rating);
    const ratingCount = optionalCount(body.rating_count);

    const rows = await query(
      `UPDATE restaurants
          SET rating = $1, rating_count = $2, updated_at = now()
        WHERE id = $3
      RETURNING id`,
      [rating, ratingCount, restaurantId],
    );
    if (rows.length === 0) {
      return Response.json({ error: "Không tìm thấy quán" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
