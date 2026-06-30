// Validate input thông tin mặc định của buyer (validate-at-the-edge, §3) — tái dùng helper ở
// adminValidate.ts. Mọi field tuỳ chọn; toạ độ không đứng một mình (cần địa chỉ).

import { ValidationError, optionalText, optionalLatLng } from "./adminValidate";

export type BuyerProfileInput = {
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

// SDT VN: 10 số bắt đầu bằng 0. Optional — rỗng/null thành null, có thì phải hợp lệ.
function optionalPhone(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") throw new ValidationError("Số điện thoại phải là chuỗi");
  const t = v.trim();
  if (!t) return null;
  if (!/^0\d{9}$/.test(t)) {
    throw new ValidationError("Số điện thoại không hợp lệ (10 số, bắt đầu 0)");
  }
  return t;
}

export function parseBuyerProfile(body: unknown): BuyerProfileInput {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Body không hợp lệ");
  }
  const b = body as Record<string, unknown>;
  const phone = optionalPhone(b.phone);
  const address = optionalText(b.address);
  const { lat, lng } = optionalLatLng(b.lat, b.lng);

  // Toạ độ không đứng một mình — phải gắn với địa chỉ đã nhập.
  if (lat !== null && address === null) {
    throw new ValidationError("Có toạ độ thì cần địa chỉ");
  }

  return { phone, address, lat, lng };
}
