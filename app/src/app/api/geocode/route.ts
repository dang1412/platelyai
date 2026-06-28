import { geocode } from "@/lib/geocode";

// GET /api/geocode?q=<địa chỉ> -> { lat, lng } | lỗi.
// Dùng cho nút "Kiểm tra địa chỉ" ở form đặt món (giao tận nơi). Key Google nằm server-side.
export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (q.length < 3) {
    return Response.json({ error: "Địa chỉ quá ngắn." }, { status: 400 });
  }

  const coords = await geocode(q);
  if (!coords) {
    return Response.json(
      { error: "Không tìm thấy toạ độ cho địa chỉ này." },
      { status: 404 },
    );
  }

  return Response.json(coords);
}
