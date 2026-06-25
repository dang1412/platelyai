import type { NextRequest } from "next/server";
import {
  getCurrentUser,
  listEditableRestaurants,
  AuthzError,
  authzResponse,
} from "@/lib/authz";

export const runtime = "nodejs";

// GET /api/admin/restaurants?q= -> danh sách quán user sửa được (client filter nếu cần;
// trang /admin dùng server-side). Trả 401 nếu chưa đăng nhập.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");

    const q = request.nextUrl.searchParams.get("q") ?? "";
    const restaurants = await listEditableRestaurants(user, q);
    return Response.json({ restaurants });
  } catch (err) {
    return authzResponse(err) ?? Response.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
