import { query } from "@/lib/db";

// POST /api/restaurants/:id/map-click -> ghi 1 event mở Google Maps (đếm + thời gian).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const restaurantId = Number(id);

  if (!Number.isInteger(restaurantId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  await query(`INSERT INTO map_clicks (restaurant_id) VALUES ($1)`, [
    restaurantId,
  ]);

  return Response.json({ ok: true });
}
