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
