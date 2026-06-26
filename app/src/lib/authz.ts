import { auth } from "@/auth";
import { query } from "@/lib/db";

// Quyền sở hữu quán cho trang admin (xem plan 04).
//
// Quy tắc:
// - role='admin' → toàn quyền mọi quán (bỏ qua restaurant_owners).
// - role='owner' → chỉ quán có dòng (restaurant_id, user_id) khớp.
// - role='user'  → không vào được /admin.
//
// Mọi API ghi gọi assertCanEdit/requireCanEdit trước khi chạm DB.

export type Role = "admin" | "owner" | "user";

export type CurrentUser = {
  id: number;
  email: string;
  name: string | null;
  role: Role;
};

// Lỗi phân quyền — route bắt rồi trả status tương ứng (xem authzResponse).
export class AuthzError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AuthzError";
  }
}

// User hiện tại từ session (null nếu chưa đăng nhập). id ép sang number cho đồng nhất với DB.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  return {
    id: Number(u.id),
    email: u.email ?? "",
    name: u.name ?? null,
    role: u.role ?? "user",
  };
}

export type EditableRestaurant = {
  id: number;
  name: string;
  address: string | null;
};

// Danh sách quán user được sửa, lọc theo tên (ILIKE, dùng index trgm). Admin thấy tất cả;
// owner chỉ thấy quán mình sở hữu; user khác trả rỗng.
export async function listEditableRestaurants(
  user: CurrentUser,
  q: string,
): Promise<EditableRestaurant[]> {
  const like = q.trim() ? `%${q.trim()}%` : null;

  if (user.role === "admin") {
    return query<EditableRestaurant>(
      `SELECT id, name, address
         FROM restaurants
        WHERE ($1::text IS NULL OR name ILIKE $1)
        ORDER BY name ASC
        LIMIT 200`,
      [like],
    );
  }

  if (user.role === "owner") {
    return query<EditableRestaurant>(
      `SELECT r.id, r.name, r.address
         FROM restaurants r
         JOIN restaurant_owners ro ON ro.restaurant_id = r.id
        WHERE ro.user_id = $1
          AND ($2::text IS NULL OR r.name ILIKE $2)
        ORDER BY r.name ASC
        LIMIT 200`,
      [user.id, like],
    );
  }

  return [];
}

// True nếu user được sửa quán này.
export async function canEdit(
  user: CurrentUser,
  restaurantId: number,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "owner") {
    const rows = await query(
      `SELECT 1 FROM restaurant_owners
        WHERE restaurant_id = $1 AND user_id = $2 LIMIT 1`,
      [restaurantId, user.id],
    );
    return rows.length > 0;
  }
  return false;
}

// Throw AuthzError nếu thiếu quyền (401 chưa login / 403 không sở hữu).
export async function assertCanEdit(
  user: CurrentUser | null,
  restaurantId: number,
): Promise<void> {
  if (!user) throw new AuthzError(401, "Chưa đăng nhập");
  if (!(await canEdit(user, restaurantId))) {
    throw new AuthzError(403, "Không có quyền sửa quán này");
  }
}

// Tiện cho API route: lấy user + đảm bảo quyền sửa, trả về user (đã chắc chắn non-null).
export async function requireCanEdit(restaurantId: number): Promise<CurrentUser> {
  const user = await getCurrentUser();
  await assertCanEdit(user, restaurantId);
  return user!;
}

// Đổi AuthzError thành Response JSON; trả null nếu không phải lỗi phân quyền (route tự xử).
export function authzResponse(err: unknown): Response | null {
  if (err instanceof AuthzError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  return null;
}
