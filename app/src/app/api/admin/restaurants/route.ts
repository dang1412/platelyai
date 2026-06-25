import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import {
  getCurrentUser,
  listEditableRestaurants,
  AuthzError,
  authzResponse,
} from "@/lib/authz";
import {
  requireText,
  optionalText,
  optionalBool,
  optionalLatLng,
  validationResponse,
} from "@/lib/adminValidate";

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

// POST /api/admin/restaurants -> tạo quán mới (chỉ admin). Toạ độ tuỳ chọn; nếu có thì set
// cả lat/lng và cột PostGIS location. Trả { id } để client chuyển sang trang sửa.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthzError(401, "Chưa đăng nhập");
    if (user.role !== "admin") throw new AuthzError(403, "Chỉ admin được tạo quán");

    const body = await request.json().catch(() => ({}));
    const name = requireText(body.name, "Tên quán");
    const address = optionalText(body.address);
    const phone = optionalText(body.phone);
    const website = optionalText(body.website);
    const servesFood = optionalBool(body.serves_food, false);
    const servesDrink = optionalBool(body.serves_drink, false);
    const { lat, lng } = optionalLatLng(body.lat, body.lng);

    // ST_MakePoint dùng thứ tự (lng, lat). location = NULL nếu thiếu toạ độ.
    const rows = await query(
      `INSERT INTO restaurants
         (name, address, phone, website, serves_food, serves_drink, lat, lng, location, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               CASE WHEN $7::float8 IS NULL OR $8::float8 IS NULL THEN NULL
                    ELSE ST_SetSRID(ST_MakePoint($8, $7), 4326)::geography END,
               'admin')
       RETURNING id`,
      [name, address, phone, website, servesFood, servesDrink, lat, lng],
    );

    return Response.json({ id: Number(rows[0].id) }, { status: 201 });
  } catch (err) {
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
