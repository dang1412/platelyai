// Validate input tạo đơn (validate-at-the-edge, §3) — tái dùng helper ở adminValidate.ts.
// Ép kiểu + chặn giá trị ngoài range TRƯỚC khi chạm DB; giá món KHÔNG lấy từ client (repo lấy từ DB).

import {
  ValidationError,
  requireIntId,
  requireText,
  optionalText,
  optionalLatLng,
} from "./adminValidate";
import type { Fulfillment, OrderStatus } from "./orders/types";

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "delivering",
  "arrived",
  "ready",
  "completed",
  "rejected",
  "cancelled",
];

// Ép `toStatus` từ body PATCH về OrderStatus hợp lệ (transition hợp lệ kiểm tiếp ở assertCanAct).
export function requireOrderStatus(v: unknown): OrderStatus {
  if (typeof v !== "string" || !ORDER_STATUSES.includes(v as OrderStatus)) {
    throw new ValidationError("Trạng thái không hợp lệ");
  }
  return v as OrderStatus;
}

export type OrderItemInput = { menuItemId: number; quantity: number };

export type CreateOrderInput = {
  restaurantId: number;
  fulfillment: Fulfillment;
  items: OrderItemInput[];
  phone: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
};

// SDT VN: 10 số bắt đầu bằng 0.
function requirePhone(v: unknown): string {
  if (typeof v !== "string" || !/^0\d{9}$/.test(v.trim())) {
    throw new ValidationError("Số điện thoại không hợp lệ");
  }
  return v.trim();
}

function parseItems(v: unknown): OrderItemInput[] {
  if (!Array.isArray(v) || v.length === 0) {
    throw new ValidationError("Đơn phải có ít nhất 1 món");
  }
  return v.map((raw) => {
    const r = raw as Record<string, unknown>;
    const menuItemId = requireIntId(r.menuItemId, "menuItemId");
    const quantity =
      typeof r.quantity === "string" ? Number(r.quantity) : (r.quantity as number);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError("Số lượng món phải là số nguyên > 0");
    }
    return { menuItemId, quantity };
  });
}

export function parseCreateOrder(body: unknown): CreateOrderInput {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Body không hợp lệ");
  }
  const b = body as Record<string, unknown>;
  const restaurantId = requireIntId(b.restaurantId, "restaurantId");
  const fulfillment = b.fulfillment;
  if (fulfillment !== "delivery" && fulfillment !== "pickup") {
    throw new ValidationError("fulfillment không hợp lệ");
  }
  const phone = requirePhone(b.phone);
  const items = parseItems(b.items);
  const note = optionalText(b.note);

  if (fulfillment === "delivery") {
    const address = requireText(b.address, "address");
    const { lat, lng } = optionalLatLng(b.lat, b.lng);
    if (lat === null || lng === null) {
      throw new ValidationError("Giao hàng cần toạ độ địa chỉ");
    }
    return { restaurantId, fulfillment, items, phone, address, lat, lng, note };
  }

  // pickup: bỏ qua field giao hàng.
  return {
    restaurantId,
    fulfillment,
    items,
    phone,
    address: null,
    lat: null,
    lng: null,
    note,
  };
}
