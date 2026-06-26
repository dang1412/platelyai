import { query } from "@/lib/db";
import { requireCanEdit, authzResponse } from "@/lib/authz";
import {
  requireIntId,
  requireText,
  optionalOrder,
  validationResponse,
} from "@/lib/adminValidate";

export const runtime = "nodejs";

// POST /api/admin/restaurants/:id/categories -> thêm category cho quán.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const restaurantId = requireIntId(id);
    await requireCanEdit(restaurantId);

    const body = await request.json().catch(() => ({}));
    const categoryName = requireText(body.category_name, "Tên nhóm");
    const displayOrder = optionalOrder(body.display_order);

    const rows = await query<{ id: string }>(
      `INSERT INTO menu_categories (restaurant_id, category_name, display_order)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [restaurantId, categoryName, displayOrder],
    );

    return Response.json({ id: Number(rows[0].id) }, { status: 201 });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
