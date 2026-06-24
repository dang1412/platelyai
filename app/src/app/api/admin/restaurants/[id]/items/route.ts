import { query } from "@/lib/db";
import { requireCanEdit, authzResponse } from "@/lib/authz";
import {
  requireIntId,
  requireText,
  optionalText,
  optionalPrice,
  optionalBool,
  validationResponse,
  ValidationError,
} from "@/lib/adminValidate";

export const runtime = "nodejs";

// POST /api/admin/restaurants/:id/items -> thêm món.
// normalized_name sinh ngay; embedding để NULL (search semantic bỏ qua tới khi re-embed offline,
// xem plan 04 §embedding). category_id (nếu có) phải thuộc đúng quán này.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const restaurantId = requireIntId(id);
    await requireCanEdit(restaurantId);

    const body = await request.json().catch(() => ({}));
    const name = requireText(body.name, "Tên món");
    const price = optionalPrice(body.price);
    const description = optionalText(body.description);
    const isAvailable = optionalBool(body.is_available, true);

    let categoryId: number | null = null;
    if (body.category_id != null && body.category_id !== "") {
      categoryId = requireIntId(body.category_id, "category_id");
      const cat = await query(
        `SELECT 1 FROM menu_categories WHERE id = $1 AND restaurant_id = $2 LIMIT 1`,
        [categoryId, restaurantId],
      );
      if (cat.length === 0) {
        throw new ValidationError("Nhóm không thuộc quán này");
      }
    }

    const rows = await query<{ id: string }>(
      `INSERT INTO menu_items
         (restaurant_id, category_id, name, normalized_name, description, price, is_available)
       VALUES ($1, $2, $3, lower(unaccent($3)), $4, $5, $6)
       RETURNING id`,
      [restaurantId, categoryId, name, description, price, isAvailable],
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
