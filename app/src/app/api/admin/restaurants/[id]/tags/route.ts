import { query } from "@/lib/db";
import { authzResponse, requireCanEdit } from "@/lib/authz";
import { requireIntId, validationResponse } from "@/lib/adminValidate";

export const runtime = "nodejs";

// Gán / gỡ tag vibe cho quán (owner hoặc admin — tag mô tả đặc điểm quán như Info).
// Tag lấy từ bảng `tags` (vocab dùng chung); body { tagId }.

// POST /api/admin/restaurants/:id/tags -> gán tag cho quán.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const restaurantId = requireIntId(id);
    await requireCanEdit(restaurantId);

    const body = await request.json().catch(() => ({}));
    const tagId = requireIntId(body.tagId, "tagId");

    const tag = await query(`SELECT 1 FROM tags WHERE id = $1 LIMIT 1`, [tagId]);
    if (tag.length === 0) {
      return Response.json({ error: "Không tìm thấy tag" }, { status: 404 });
    }

    await query(
      `INSERT INTO restaurant_tags (restaurant_id, tag_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [restaurantId, tagId],
    );

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}

// DELETE /api/admin/restaurants/:id/tags -> gỡ tag khỏi quán.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const restaurantId = requireIntId(id);
    await requireCanEdit(restaurantId);

    const body = await request.json().catch(() => ({}));
    const tagId = requireIntId(body.tagId, "tagId");

    await query(
      `DELETE FROM restaurant_tags WHERE restaurant_id = $1 AND tag_id = $2`,
      [restaurantId, tagId],
    );

    return Response.json({ ok: true });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
