import { requireCanEdit, authzResponse } from "@/lib/authz";
import {
  requireIntId,
  requireText,
  optionalText,
  optionalPrice,
  optionalKind,
  optionalOrder,
  validationResponse,
  ValidationError,
} from "@/lib/adminValidate";
import { importMenu, type ImportCategory } from "@/lib/menuImport";

export const runtime = "nodejs";

// POST /api/admin/restaurants/:id/menu/import -> merge/upsert menu (preview admin đã sửa) vào DB.
// Validate-at-the-edge: ép kiểu mọi field TRƯỚC khi chạm DB. Bỏ category không có món hợp lệ.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const restaurantId = requireIntId(id);
    await requireCanEdit(restaurantId);

    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body?.categories)) {
      throw new ValidationError("categories phải là mảng");
    }

    const categories: ImportCategory[] = [];
    body.categories.forEach((cat: unknown, ci: number) => {
      const c = cat as Record<string, unknown>;
      const categoryName = requireText(c?.category_name, `Tên nhóm #${ci + 1}`);
      const kind = optionalKind(c?.kind);
      const displayOrder = c?.display_order != null ? optionalOrder(c.display_order) : ci;

      const rawItems = Array.isArray(c?.items) ? c.items : [];
      const items = rawItems.map((it: unknown) => {
        const i = it as Record<string, unknown>;
        return {
          name: requireText(i?.name, "Tên món"),
          price: optionalPrice(i?.price),
          description: optionalText(i?.description),
        };
      });

      if (items.length === 0) return; // bỏ nhóm rỗng
      categories.push({ categoryName, kind, displayOrder, items });
    });

    if (categories.length === 0) {
      throw new ValidationError("Không có món nào để nhập");
    }

    const result = await importMenu(restaurantId, categories);
    return Response.json(result, { status: 201 });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
