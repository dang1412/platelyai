import { query } from "@/lib/db";

// Tải chi tiết quán + menu cho trang sửa (/admin/restaurants/[id]). Khác API public
// (api/restaurants/[id]) ở chỗ trả kèm id category/món + kind/display_order/is_available để edit.

export type MenuKind = "food" | "drink" | "other";

export type EditItem = {
  id: number;
  name: string;
  price: number | null;
  description: string | null;
  categoryId: number | null;
  isAvailable: boolean;
};

export type EditCategory = {
  id: number; // 0 = nhóm "chưa phân loại" (món có category_id NULL)
  categoryName: string;
  kind: MenuKind | null;
  displayOrder: number;
  items: EditItem[];
};

export type RestaurantForEdit = {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  servesFood: boolean | null;
  servesDrink: boolean | null;
  lat: number | null;
  lng: number | null;
  rating: string | null; // NUMERIC → pg trả string
  ratingCount: number | null;
  categories: EditCategory[];
};

export async function getRestaurantForEdit(
  restaurantId: number,
): Promise<RestaurantForEdit | null> {
  const rows = await query(
    `SELECT id, name, address, phone, website, lat, lng, rating,
            serves_food  AS "servesFood",
            serves_drink AS "servesDrink",
            rating_count AS "ratingCount"
       FROM restaurants WHERE id = $1 LIMIT 1`,
    [restaurantId],
  );
  const r = rows[0];
  if (!r) return null;

  const catRows = await query(
    `SELECT id,
            category_name AS "categoryName",
            kind,
            display_order AS "displayOrder"
       FROM menu_categories
      WHERE restaurant_id = $1
      ORDER BY display_order ASC, id ASC`,
    [restaurantId],
  );

  const itemRows = await query(
    `SELECT id, name, price, description,
            category_id  AS "categoryId",
            is_available AS "isAvailable"
       FROM menu_items
      WHERE restaurant_id = $1
      ORDER BY id ASC`,
    [restaurantId],
  );

  // Gom món theo category. Món có category_id NULL gom vào nhóm ảo id=0.
  const categories: EditCategory[] = catRows.map((c) => ({
    id: Number(c.id),
    categoryName: c.categoryName as string,
    kind: (c.kind as MenuKind | null) ?? null,
    displayOrder: Number(c.displayOrder ?? 0),
    items: [],
  }));
  const byId = new Map<number, EditCategory>(categories.map((c) => [c.id, c]));

  let uncategorized: EditCategory | null = null;
  for (const it of itemRows) {
    const item: EditItem = {
      id: Number(it.id),
      name: it.name as string,
      price: it.price != null ? Number(it.price) : null,
      description: (it.description as string | null) ?? null,
      categoryId: it.categoryId != null ? Number(it.categoryId) : null,
      isAvailable: it.isAvailable !== false,
    };
    const cat = item.categoryId != null ? byId.get(item.categoryId) : undefined;
    if (cat) {
      cat.items.push(item);
    } else {
      if (!uncategorized) {
        uncategorized = {
          id: 0,
          categoryName: "Chưa phân loại",
          kind: null,
          displayOrder: 9999,
          items: [],
        };
      }
      uncategorized.items.push(item);
    }
  }
  if (uncategorized) categories.push(uncategorized);

  return {
    id: Number(r.id),
    name: r.name as string,
    address: (r.address as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    website: (r.website as string | null) ?? null,
    servesFood: (r.servesFood as boolean | null) ?? null,
    servesDrink: (r.servesDrink as boolean | null) ?? null,
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    rating: (r.rating as string | null) ?? null,
    ratingCount: r.ratingCount != null ? Number(r.ratingCount) : null,
    categories,
  };
}
