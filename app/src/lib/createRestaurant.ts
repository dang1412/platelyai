import { withTransaction } from "@/lib/db";

// Tạo quán self-serve: user thường tự tạo quán và trở thành chủ quán (owner). Gom 3 thao tác
// vào một transaction cho nguyên tử: insert quán (source='user') + gán owner + nâng role.
//
// Lưu ý: KHÔNG import @/lib/authz / @/auth ở đây (kéo next-auth, vitest không nạp được — xem
// owners.ts). Route lo authz/validate; lib chỉ chạm DB, tham số hoá $1,$2…

export type CreateRestaurantInput = {
  ownerId: number;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
};

export async function createOwnedRestaurant(
  input: CreateRestaurantInput,
): Promise<{ id: number }> {
  const { ownerId, name, address, phone, website, lat, lng } = input;

  return withTransaction(async (q) => {
    // ST_MakePoint dùng thứ tự (lng, lat). location = NULL nếu thiếu toạ độ.
    const rows = await q<{ id: string }>(
      `INSERT INTO restaurants
         (name, address, phone, website, lat, lng, location, source)
       VALUES ($1, $2, $3, $4, $5, $6,
               CASE WHEN $5::float8 IS NULL OR $6::float8 IS NULL THEN NULL
                    ELSE ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography END,
               'user')
       RETURNING id`,
      [name, address, phone, website, lat, lng],
    );
    const id = Number(rows[0].id);

    await q(
      `INSERT INTO restaurant_owners (restaurant_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, ownerId],
    );
    // Nâng 'user' -> 'owner' để vào được khu quản trị nhập menu. KHÔNG đụng 'admin'.
    await q(`UPDATE users SET role = 'owner' WHERE id = $1 AND role = 'user'`, [ownerId]);

    return { id };
  });
}
