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

// Lấy restaurant_id + tên hiện tại của món (để kiểm quyền + phát hiện đổi tên). null nếu không có.
async function loadItem(
  itemId: number,
): Promise<{ restaurantId: number; name: string } | null> {
  const rows = await query<{ restaurant_id: string; name: string }>(
    `SELECT restaurant_id, name FROM menu_items WHERE id = $1 LIMIT 1`,
    [itemId],
  );
  return rows[0]
    ? { restaurantId: Number(rows[0].restaurant_id), name: rows[0].name }
    : null;
}

// PATCH /api/admin/items/:id -> sửa món. Khi ĐỔI TÊN: cập nhật normalized_name và reset
// embedding = NULL để search semantic không lệch (re-embed offline sau, plan 04 §embedding).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const itemId = requireIntId(id);
    const current = await loadItem(itemId);
    if (!current) {
      return Response.json({ error: "Không tìm thấy món" }, { status: 404 });
    }
    await requireCanEdit(current.restaurantId);

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
        [categoryId, current.restaurantId],
      );
      if (cat.length === 0) {
        throw new ValidationError("Nhóm không thuộc quán này");
      }
    }

    const nameChanged = name !== current.name;
    if (nameChanged) {
      await query(
        `UPDATE menu_items
            SET name = $1, normalized_name = lower(unaccent($1)), embedding = NULL,
                price = $2, description = $3, category_id = $4, is_available = $5,
                updated_at = now()
          WHERE id = $6`,
        [name, price, description, categoryId, isAvailable, itemId],
      );
    } else {
      await query(
        `UPDATE menu_items
            SET price = $1, description = $2, category_id = $3, is_available = $4,
                updated_at = now()
          WHERE id = $5`,
        [price, description, categoryId, isAvailable, itemId],
      );
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

// DELETE /api/admin/items/:id -> xoá món.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const itemId = requireIntId(id);
    const current = await loadItem(itemId);
    if (!current) {
      return Response.json({ error: "Không tìm thấy món" }, { status: 404 });
    }
    await requireCanEdit(current.restaurantId);

    await query(`DELETE FROM menu_items WHERE id = $1`, [itemId]);
    return Response.json({ ok: true });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
