import type { NextRequest } from "next/server";
import { getCurrentUser, AuthzError, authzResponse } from "@/lib/authz";
import {
  requireText,
  optionalText,
  optionalLatLng,
  validationResponse,
} from "@/lib/adminValidate";
import { createOwnedRestaurant } from "@/lib/createRestaurant";

export const runtime = "nodejs";

// POST /api/restaurants -> user thường tự tạo quán (self-serve). Chỉ cần đã đăng nhập; người
// tạo tự thành chủ quán (owner) và được nâng role. Toạ độ tuỳ chọn. Trả { id } để client
// chuyển sang trang sửa quán nhập menu.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");

    const body = await request.json().catch(() => ({}));
    const name = requireText(body.name, "Tên quán");
    const address = optionalText(body.address);
    const phone = optionalText(body.phone);
    const website = optionalText(body.website);
    const { lat, lng } = optionalLatLng(body.lat, body.lng);

    const { id } = await createOwnedRestaurant({
      ownerId: user.id,
      name,
      address,
      phone,
      website,
      lat,
      lng,
    });

    return Response.json({ id }, { status: 201 });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
