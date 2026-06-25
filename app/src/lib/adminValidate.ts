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

export function optionalBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

// Đổi ValidationError thành Response 400; null nếu không phải lỗi validate.
export function validationResponse(err: unknown): Response | null {
  if (err instanceof ValidationError) {
    return Response.json({ error: err.message }, { status: 400 });
  }
  return null;
}
