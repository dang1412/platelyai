import type { NextRequest } from "next/server";
import { getCurrentUser, AuthzError, authzResponse } from "@/lib/authz";
import { requireIntId, validationResponse } from "@/lib/adminValidate";
import {
  isFavorite,
  addFavorite,
  removeFavorite,
  listFavoriteRestaurants,
  countFavorites,
} from "@/lib/favorites/repo";

export const runtime = "nodejs";

// GET /api/favorites
//   ?restaurantId=<id> → { favorite: boolean } (trạng thái 1 quán, cho nút tim ở modal)
//   ?count=1           → { count } (badge side menu — chỉ COUNT)
//   không param        → { restaurants: [...] } (danh sách quán yêu thích, cho trang /favorites)
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");

    const sp = request.nextUrl.searchParams;
    const raw = sp.get("restaurantId");
    if (raw != null) {
      const restaurantId = requireIntId(raw, "restaurantId");
      return Response.json({ favorite: await isFavorite(user.id, restaurantId) });
    }
    if (sp.get("count") === "1") {
      return Response.json({ count: await countFavorites(user.id) });
    }
    return Response.json({ restaurants: await listFavoriteRestaurants(user.id) });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}

// POST /api/favorites — đánh dấu yêu thích. body { restaurantId }.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");

    const body = await request.json().catch(() => ({}));
    const restaurantId = requireIntId((body as { restaurantId?: unknown }).restaurantId, "restaurantId");
    await addFavorite(user.id, restaurantId);
    return Response.json({ favorite: true });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}

// DELETE /api/favorites — bỏ yêu thích. body { restaurantId }.
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");

    const body = await request.json().catch(() => ({}));
    const restaurantId = requireIntId((body as { restaurantId?: unknown }).restaurantId, "restaurantId");
    await removeFavorite(user.id, restaurantId);
    return Response.json({ favorite: false });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
