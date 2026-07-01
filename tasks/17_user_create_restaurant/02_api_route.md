# 02 — route `POST /api/restaurants`

## Vì sao
Cần endpoint buyer-facing để user thường tạo quán, tách khỏi `/api/admin/restaurants` (admin-only,
không gán owner).

## Việc
- File mới `app/src/app/api/restaurants/route.ts` (hiện chỉ có `[id]/`):
  - `export const runtime = "nodejs"`.
  - `export async function POST(request)`:
    - **Authz (MUST):** `getCurrentUser()` từ `@/lib/authz`; nếu `!user` → `throw new AuthzError(401, "Chưa đăng nhập")`. **Không** kiểm role.
    - **Validate (MUST):** `body = await request.json().catch(()=>({}))`; reuse từ `@/lib/adminValidate`:
      `name = requireText(body.name, "Tên quán")`, `optionalText(body.address/phone/website)`,
      `{lat,lng} = optionalLatLng(body.lat, body.lng)`.
    - Gọi `createOwnedRestaurant({ ownerId: user.id, name, address, phone, website, lat, lng })`.
    - `return Response.json({ id }, { status: 201 })`.
    - Catch: `authzResponse(err) ?? validationResponse(err) ?? Response.json({ error: "Lỗi máy chủ" }, { status: 500 })`.

## Done khi
- Chưa đăng nhập → 401; input thiếu tên/lat-lng lệch → 400; hợp lệ → 201 `{ id }`.
- Không nội suy chuỗi SQL (mọi DB nằm trong lib task 01).
