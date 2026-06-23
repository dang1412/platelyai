// Kiểu dùng chung giữa các bước của Search API.

// Toạ độ điểm gốc (origin) để lọc/rank theo khoảng cách.
export type LatLng = { lat: number; lng: number };

// Yếu tố 1 — loại hình quán user muốn (null = không xác định).
export type FoodCategory = "food" | "drink";

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

// Ý định tìm kiếm trích từ câu tự nhiên (xem lib/extract.ts). Đúng 6 yếu tố của plan 01.
export type ParsedQuery = {
  category: FoodCategory | null; // 1 — lọc cứng
  dishes: string[]; // 2 — lọc cứng (tên món cụ thể)
  tags: string[]; // 3 — ranking (đã validate trong vocab bảng tags)
  location: string | null; // 4 — lọc cứng (qua origin)
  maxPrice: number | null; // 5 — lọc cứng (giá tối đa MỘT món, VND)
  wantsCheap: boolean; // 6 — ranking (cộng trọng số quán có món rẻ)
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
};

// ── Chi tiết quán (/api/restaurants/:id) ─────────────────────────────────────

// Một món trong thực đơn modal chi tiết.
export type MenuItem = {
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

// Link Google Maps: ưu tiên place_id (chính xác), fallback tìm theo tên.
export function mapUrl(placeId: string | null, name: string): string {
  const query = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  return placeId ? `${query}&query_place_id=${placeId}` : query;
}
