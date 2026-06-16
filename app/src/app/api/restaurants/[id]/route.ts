import { query } from "@/lib/db";
import type { MenuCategory, RestaurantDetail } from "@/lib/types";

// GET /api/restaurants/:id -> thông tin chi tiết quán + menu gom theo category.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const restaurantId = Number(id);

  if (!Number.isInteger(restaurantId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  // Thông tin quán + tag vibe (bảng tags qua restaurant_tags).
  const rows = await query(
    `SELECT r.id, r.name, r.address,
            r.rating       AS "rating",
            r.rating_count AS "ratingCount",
            (SELECT array_agg(t.name)
               FROM restaurant_tags rt JOIN tags t ON t.id = rt.tag_id
              WHERE rt.restaurant_id = r.id) AS "tags",
            r.website,
            r.google_place_id AS "googlePlaceId",
            r.lat, r.lng, r.phone
       FROM restaurants r
      WHERE r.id = $1
      LIMIT 1`,
    [restaurantId],
  );
  const restaurant = rows[0];

  if (!restaurant) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Toàn bộ món kèm tên category, sắp theo display_order rồi id.
  const menuRows = await query(
    `SELECT mc.id           AS "categoryId",
            mc.category_name AS "categoryName",
            mi.name          AS "itemName",
            mi.price,
            mi.description
       FROM menu_categories mc
       JOIN menu_items mi ON mi.category_id = mc.id
      WHERE mc.restaurant_id = $1
      ORDER BY mc.display_order ASC, mi.id ASC`,
    [restaurantId],
  );

  // Gom món theo category, giữ thứ tự xuất hiện.
  const byCategory = new Map<string, MenuCategory>();
  for (const r of menuRows) {
    const key = `${r.categoryId}`;
    let cat = byCategory.get(key);
    if (!cat) {
      cat = { categoryName: r.categoryName as string, items: [] };
      byCategory.set(key, cat);
    }
    cat.items.push({
      name: r.itemName as string,
      price: r.price != null ? Number(r.price) : null,
      description: (r.description as string | null) ?? null,
    });
  }

  const detail: RestaurantDetail = {
    restaurant: {
      id: Number(restaurant.id),
      name: restaurant.name as string,
      address: (restaurant.address as string | null) ?? null,
      rating: (restaurant.rating as string | null) ?? null,
      ratingCount:
        restaurant.ratingCount != null ? Number(restaurant.ratingCount) : null,
      tags: (restaurant.tags as string[] | null) ?? null,
      website: (restaurant.website as string | null) ?? null,
      googlePlaceId: (restaurant.googlePlaceId as string | null) ?? null,
      lat: restaurant.lat != null ? Number(restaurant.lat) : null,
      lng: restaurant.lng != null ? Number(restaurant.lng) : null,
      phone: (restaurant.phone as string | null) ?? null,
    },
    menu: Array.from(byCategory.values()),
  };

  return Response.json(detail);
}
