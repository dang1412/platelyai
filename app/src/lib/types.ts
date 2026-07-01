// Kiểu dùng chung giữa các bước của Search API.

// Toạ độ điểm gốc (origin) để lọc/rank theo khoảng cách.
export type LatLng = { lat: number; lng: number };

// Một menu_item khớp với một tên món user hỏi (xem lib/dishes.ts). Tầng rank/route gom theo
// restaurantId. `dist` = cosine distance (0 = khớp tuyệt đối, lexical name = 0); `queryDish` giữ
// lại tên gốc đã hỏi để đếm độ phủ (coverage) ở bước rank.
export type MatchedDish = {
  itemId: number;
  restaurantId: number;
  name: string;
  price: number | null;
  dist: number;
  queryDish: string;
};

// Ý định tìm kiếm trích từ câu tự nhiên (xem lib/extract.ts). Trục food/drink KHÔNG còn là field
// riêng (plan 09): khi dishes rỗng, extract gắn type-tag "quán ăn"/"giải khát" vào tags (rank mềm).
export type ParsedQuery = {
  dishes: string[]; // lọc cứng (tên món cụ thể)
  tags: string[]; // ranking (đã validate trong vocab bảng tags; gồm cả type-tag ăn/uống)
  location: string | null; // lọc cứng (qua origin)
  maxPrice: number | null; // lọc cứng (giá tối đa MỘT món, VND)
  wantsCheap: boolean; // ranking (cộng trọng số quán có món rẻ)
};

// Một quán trong kết quả /api/search (xem plan 01 §1). `rating` là string vì numeric của pg trả
// về dạng chuỗi. `distanceM`/`matchedDishes` chỉ có ở ca tương ứng (có origin / nhánh MÓN).
export type RestaurantSummary = {
  id: number;
  name: string;
  address: string | null;
  rating: string | null;
  ratingCount: number | null;
  tags: string[]; // vibe tag của quán (bảng tags), để card hiển thị + rank cộng điểm trùng
  website: string | null;
  googlePlaceId: string | null;
  distanceM?: number | null; // khoảng cách (m) tới origin, null nếu không có origin
  matchedDishes?: { name: string; price: number | null }[]; // chip món khớp (nhánh MÓN)
};

// Kết quả /api/search: kèm ý định đã trích để UI hiển thị "đang hiểu query thế này".
export type SearchResponse = {
  parsed: ParsedQuery | null; // null khi không trích được (query rỗng / fallback)
  results: RestaurantSummary[];
  // true khi extract (gọi Gemini) lỗi → kết quả chạy chế độ degraded (rank theo rating).
  // Chỉ là cờ, KHÔNG lộ message lỗi thô ra client. Client dùng để báo toast cho user.
  extractFailed?: boolean;
};

// ── Chi tiết quán (/api/restaurants/:id) ─────────────────────────────────────

// Một món trong thực đơn modal chi tiết.
export type MenuItem = {
  id: number; // menu_items.id — cần để đặt món (plan 10)
  name: string;
  price: number | null;
  description: string | null;
};

// Nhóm món theo category (giữ thứ tự display_order).
export type MenuCategory = {
  categoryName: string;
  items: MenuItem[];
};

// Thông tin đầy đủ của một quán cho modal chi tiết. `rating` là string (numeric pg).
export type RestaurantInfo = {
  id: number;
  name: string;
  address: string | null;
  rating: string | null;
  ratingCount: number | null;
  tags: string[] | null;
  website: string | null;
  googlePlaceId: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
};

// Payload /api/restaurants/:id — thông tin quán + menu gom theo category.
export type RestaurantDetail = {
  restaurant: RestaurantInfo;
  menu: MenuCategory[];
};

// Link Google Maps theo thứ tự chính xác giảm dần:
//  1. place_id (quán crawl từ Google) → mở đúng địa điểm.
//  2. lat/lng (quán thêm tay, không place_id) → mở đúng toạ độ đã lưu, không lệch theo tên.
//  3. fallback → tìm theo tên.
export function mapUrl(
  placeId: string | null,
  name: string,
  lat?: number | null,
  lng?: number | null,
): string {
  if (placeId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${placeId}`;
  }
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}
