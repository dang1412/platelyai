import { query } from "@/lib/db";

// Logic chủ quán (owner) cho trang admin. Quán ⋈ user qua bảng nối restaurant_owners
// (nhiều-nhiều, xem db/init/03_admin.sql). Route chỉ validate + gọi các hàm ở đây.
//
// Lưu ý: KHÔNG import @/lib/authz ở đây — nó kéo @/auth (next-auth) vốn không nạp được dưới
// vitest. Lỗi "email chưa đăng nhập" dùng OwnerError (có status) để route tự map response.

export type Owner = { id: number; name: string | null; email: string };

// Lỗi nghiệp vụ owner — route map sang Response theo status (vd email chưa đăng nhập → 404).
export class OwnerError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "OwnerError";
  }
}

export function ownerErrorResponse(err: unknown): Response | null {
  if (err instanceof OwnerError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  return null;
}

// Danh sách chủ quán của một quán (tên + email), sort theo email cho ổn định.
export async function listRestaurantOwners(
  restaurantId: number,
): Promise<Owner[]> {
  const rows = await query<{ id: string; name: string | null; email: string }>(
    `SELECT u.id, u.name, u.email
       FROM restaurant_owners ro
       JOIN users u ON u.id = ro.user_id
      WHERE ro.restaurant_id = $1
      ORDER BY u.email ASC`,
    [restaurantId],
  );
  return rows.map((r) => ({ id: Number(r.id), name: r.name, email: r.email }));
}

// Gán owner theo email. User phải đã từng đăng nhập (có dòng trong users).
// Gán xong nâng role 'user' -> 'owner' để họ vào được /admin. Idempotent (ON CONFLICT).
export async function assignRestaurantOwner(
  restaurantId: number,
  email: string,
): Promise<void> {
  const users = await query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()],
  );
  if (users.length === 0) {
    throw new OwnerError(404, "Email chưa từng đăng nhập hệ thống");
  }
  const userId = Number(users[0].id);

  await query(
    `INSERT INTO restaurant_owners (restaurant_id, user_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [restaurantId, userId],
  );
  await query(`UPDATE users SET role = 'owner' WHERE id = $1 AND role = 'user'`, [
    userId,
  ]);
}

// Gỡ owner khỏi quán (idempotent). Nếu sau khi gỡ user không còn sở hữu quán nào thì hạ
// role 'owner' -> 'user'. KHÔNG bao giờ đụng role 'admin'.
export async function removeRestaurantOwner(
  restaurantId: number,
  userId: number,
): Promise<void> {
  await query(
    `DELETE FROM restaurant_owners WHERE restaurant_id = $1 AND user_id = $2`,
    [restaurantId, userId],
  );
  await query(
    `UPDATE users SET role = 'user'
      WHERE id = $1 AND role = 'owner'
        AND NOT EXISTS (SELECT 1 FROM restaurant_owners WHERE user_id = $1)`,
    [userId],
  );
}
