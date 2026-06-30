import type { NextRequest } from "next/server";
import { getCurrentUser, AuthzError, authzResponse } from "@/lib/authz";
import { validationResponse } from "@/lib/adminValidate";
import { parseBuyerProfile } from "@/lib/profileValidate";
import { getBuyerProfile, upsertBuyerProfile } from "@/lib/profile/repo";

export const runtime = "nodejs";

// GET /api/profile — thông tin mặc định của buyer hiện tại (prefill form đặt món + trang /profile).
export async function GET(): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");
    const profile = await getBuyerProfile(user.id);
    return Response.json({ profile });
  } catch (err) {
    return authzResponse(err) ?? Response.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}

// PUT /api/profile — lưu thông tin mặc định. Validate-at-the-edge trước khi chạm DB.
export async function PUT(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");

    const body = await request.json().catch(() => ({}));
    const input = parseBuyerProfile(body);
    await upsertBuyerProfile(user.id, input);
    return Response.json({ profile: input });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
