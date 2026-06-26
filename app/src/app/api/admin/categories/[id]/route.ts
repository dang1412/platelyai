import { query } from "@/lib/db";
import { requireCanEdit, authzResponse } from "@/lib/authz";
import {
  requireIntId,
  requireText,
  optionalOrder,
  validationResponse,
} from "@/lib/adminValidate";

export const runtime = "nodejs";

// Lấy restaurant_id của category để kiểm quyền; null nếu không tồn tại.
async function ownerRestaurant(categoryId: number): Promise<number | null> {
  const rows = await query<{ restaurant_id: string }>(
    `SELECT restaurant_id FROM menu_categories WHERE id = $1 LIMIT 1`,
    [categoryId],
  );
  return rows[0] ? Number(rows[0].restaurant_id) : null;
}

// PATCH /api/admin/categories/:id -> sửa category.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const categoryId = requireIntId(id);
    const restaurantId = await ownerRestaurant(categoryId);
    if (restaurantId == null) {
      return Response.json({ error: "Không tìm thấy nhóm" }, { status: 404 });
    }
    await requireCanEdit(restaurantId);

    const body = await request.json().catch(() => ({}));
    const categoryName = requireText(body.category_name, "Tên nhóm");
    const displayOrder = optionalOrder(body.display_order);

    await query(
      `UPDATE menu_categories
          SET category_name = $1, display_order = $2
        WHERE id = $3`,
      [categoryName, displayOrder, categoryId],
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

// DELETE /api/admin/categories/:id -> xoá category (món con: FK ON DELETE SET NULL).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const categoryId = requireIntId(id);
    const restaurantId = await ownerRestaurant(categoryId);
    if (restaurantId == null) {
      return Response.json({ error: "Không tìm thấy nhóm" }, { status: 404 });
    }
    await requireCanEdit(restaurantId);

    await query(`DELETE FROM menu_categories WHERE id = $1`, [categoryId]);
    return Response.json({ ok: true });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
