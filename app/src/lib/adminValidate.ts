import type { MenuKind } from "@/lib/adminRestaurant";

// Helpers validate input cho API ghi của admin (validate-at-the-edge, plan 04 §API).
// Trả về kiểu đã ép hoặc ném thông điệp lỗi để route trả 400.

export class ValidationError extends Error {}

// id số nguyên dương (từ params hoặc body). Ném 400 nếu không hợp lệ.
export function requireIntId(v: unknown, field = "id"): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError(`${field} không hợp lệ`);
  }
  return n;
}

// Chuỗi bắt buộc, không rỗng sau trim.
export function requireText(v: unknown, field: string): string {
  if (typeof v !== "string" || !v.trim()) {
    throw new ValidationError(`${field} không được rỗng`);
  }
  return v.trim();
}

// Chuỗi tuỳ chọn → trim, rỗng/undefined/null thành null.
export function optionalText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") throw new ValidationError("Giá trị phải là chuỗi");
  const t = v.trim();
  return t ? t : null;
}

// Giá: số nguyên ≥ 0 hoặc null.
export function optionalPrice(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (!Number.isInteger(n) || n < 0) {
    throw new ValidationError("Giá phải là số nguyên ≥ 0");
  }
  return n;
}

// kind ∈ {food,drink,other} hoặc null.
export function optionalKind(v: unknown): MenuKind | null {
  if (v == null || v === "") return null;
  if (v === "food" || v === "drink" || v === "other") return v;
  throw new ValidationError("kind phải là food | drink | other");
}

// display_order: số nguyên, mặc định 0.
export function optionalOrder(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (!Number.isInteger(n)) throw new ValidationError("display_order phải là số nguyên");
  return n;
}

// Rating: số trong [0, 5] (làm tròn 1 chữ số thập phân, khớp cột NUMERIC(2,1)) hoặc null.
export function optionalRating(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (!Number.isFinite(n) || n < 0 || n > 5) {
    throw new ValidationError("Điểm đánh giá phải trong khoảng [0, 5]");
  }
  return Math.round(n * 10) / 10;
}

// rating_count: số nguyên ≥ 0 hoặc null.
export function optionalCount(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (!Number.isInteger(n) || n < 0) {
    throw new ValidationError("Số lượt đánh giá phải là số nguyên ≥ 0");
  }
  return n;
}

export function optionalBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

// Toạ độ: lat/lng phải đi cùng nhau (cả hai hoặc cả hai null). Dùng chung cho POST/PATCH quán.
export function optionalLatLng(
  latRaw: unknown,
  lngRaw: unknown,
): { lat: number | null; lng: number | null } {
  const hasLat = latRaw != null && latRaw !== "";
  const hasLng = lngRaw != null && lngRaw !== "";
  if (!hasLat && !hasLng) return { lat: null, lng: null };
  if (hasLat !== hasLng) {
    throw new ValidationError("Cần cả lat và lng");
  }
  const lat = typeof latRaw === "string" ? Number(latRaw) : (latRaw as number);
  const lng = typeof lngRaw === "string" ? Number(lngRaw) : (lngRaw as number);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new ValidationError("lat phải trong khoảng [-90, 90]");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new ValidationError("lng phải trong khoảng [-180, 180]");
  }
  return { lat, lng };
}

// Đổi ValidationError thành Response 400; null nếu không phải lỗi validate.
export function validationResponse(err: unknown): Response | null {
  if (err instanceof ValidationError) {
    return Response.json({ error: err.message }, { status: 400 });
  }
  return null;
}
