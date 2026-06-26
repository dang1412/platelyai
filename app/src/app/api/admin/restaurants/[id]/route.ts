import { query } from "@/lib/db";
import { requireCanEdit, authzResponse } from "@/lib/authz";
import {
  requireIntId,
  requireText,
  optionalText,
  optionalLatLng,
  validationResponse,
} from "@/lib/adminValidate";

export const runtime = "nodejs";

// PATCH /api/admin/restaurants/:id -> sửa thông tin quán.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const restaurantId = requireIntId(id);
    await requireCanEdit(restaurantId);

    const body = await request.json().catch(() => ({}));
    const name = requireText(body.name, "Tên quán");
    const address = optionalText(body.address);
    const phone = optionalText(body.phone);
    const website = optionalText(body.website);
    const { lat, lng } = optionalLatLng(body.lat, body.lng);

    // ST_MakePoint dùng thứ tự (lng, lat). Form edit luôn gửi lại toạ độ hiện có nên không mất dữ liệu.
    const rows = await query(
      `UPDATE restaurants
          SET name = $1, address = $2, phone = $3, website = $4,
              lat = $5, lng = $6,
              location = CASE WHEN $5::float8 IS NULL OR $6::float8 IS NULL THEN NULL
                              ELSE ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography END,
              updated_at = now()
        WHERE id = $7
      RETURNING id`,
      [name, address, phone, website, lat, lng, restaurantId],
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
