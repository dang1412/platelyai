import { query } from "@/lib/db";
import { requireCanEdit, authzResponse } from "@/lib/authz";
import { requireIntId, validationResponse, ValidationError } from "@/lib/adminValidate";
import { parseMenuImages } from "@/lib/menuParse";

export const runtime = "nodejs";

const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024; // ~5MB / ảnh
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

// POST /api/admin/restaurants/:id/menu/parse -> đọc ảnh menu bằng Gemini Vision,
// trả về JSON preview (categories[].items[]). KHÔNG ghi DB — admin xem/sửa rồi mới import.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const restaurantId = requireIntId(id);
    await requireCanEdit(restaurantId);

    const rows = await query<{ name: string }>(
      `SELECT name FROM restaurants WHERE id = $1 LIMIT 1`,
      [restaurantId],
    );
    if (rows.length === 0) throw new ValidationError("Không tìm thấy quán");
    const restaurantName = rows[0].name;

    // Validate ảnh TRƯỚC khi gọi AI (tránh tốn lời gọi Gemini cho input sai).
    const form = await request.formData().catch(() => null);
    const files = (form?.getAll("images") ?? []).filter(
      (f): f is File => f instanceof File,
    );
    if (files.length === 0) throw new ValidationError("Chưa có ảnh nào");
    if (files.length > MAX_IMAGES) {
      throw new ValidationError(`Tối đa ${MAX_IMAGES} ảnh mỗi lần`);
    }
    for (const f of files) {
      if (!ALLOWED_MIME.has(f.type)) {
        throw new ValidationError("Chỉ nhận ảnh JPEG, PNG hoặc WebP");
      }
      if (f.size > MAX_BYTES) {
        throw new ValidationError("Mỗi ảnh tối đa 5MB");
      }
    }

    const images = await Promise.all(
      files.map(async (f) => ({
        data: Buffer.from(await f.arrayBuffer()),
        mimeType: f.type,
      })),
    );

    const menu = await parseMenuImages(images, restaurantName);
    return Response.json(menu);
  } catch (err) {
    if (err instanceof Error && err.message.includes("GEMINI_API_KEY")) {
      return Response.json({ error: "Chưa cấu hình AI" }, { status: 503 });
    }
    return (
      authzResponse(err) ??
      validationResponse(err) ??
      Response.json({ error: "Lỗi máy chủ" }, { status: 500 })
    );
  }
}
