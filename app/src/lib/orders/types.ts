// Kiểu dùng chung cho luồng đặt món (feature 11 — UI mock; tái dùng cho plan 10 backend).

// Cách nhận hàng: giao tận nơi hoặc tới quầy lấy.
export type Fulfillment = "delivery" | "pickup";

// Trạng thái đơn — khớp CHECK constraint dự kiến ở plan 10 (db/init/11_orders.sql).
//  delivery: pending → accepted → delivering → arrived → completed
//  pickup:   pending → accepted → ready                → completed
//  kết thúc sớm: rejected (seller từ chối) | cancelled (buyer huỷ)
export type OrderStatus =
  | "pending"
  | "accepted"
  | "delivering"
  | "arrived"
  | "ready"
  | "completed"
  | "rejected"
  | "cancelled";

// Một dòng món trong đơn (UI mock dùng tên+giá snapshot; menuItemId thêm ở plan 10).
export type OrderItem = {
  name: string;
  price: number; // VND
  quantity: number;
};

// Một mốc đổi trạng thái (append-only, render timeline). `at` là ISO string.
export type OrderEvent = {
  status: OrderStatus;
  at: string;
  note?: string;
};

// Một đơn hàng đầy đủ để render phía buyer.
export type Order = {
  id: string;
  restaurantId: string; // id quán (seller lọc theo quán); thêm ở plan 10
  restaurantName: string;
  fulfillment: Fulfillment;
  status: OrderStatus;
  items: OrderItem[];
  total: number; // VND, tổng đã tính
  phone: string;
  address?: string | null; // chỉ có khi delivery
  lat?: number | null; // toạ độ giao (bắt buộc khi delivery) — mở bản đồ không cần geocode lại
  lng?: number | null;
  note?: string | null;
  events: OrderEvent[];
  createdAt: string;
};
