// Kiểu dùng chung giữa các bước của Search API.

// Yếu tố 1 — loại hình quán user muốn (null = không xác định).
export type FoodCategory = "food" | "drink";

// Ý định tìm kiếm trích từ câu tự nhiên (xem lib/extract.ts). Đúng 6 yếu tố của plan 01.
export type ParsedQuery = {
  category: FoodCategory | null; // 1 — lọc cứng
  dishes: string[]; // 2 — lọc cứng (tên món cụ thể)
  tags: string[]; // 3 — ranking (đã validate trong vocab bảng tags)
  location: string | null; // 4 — lọc cứng (qua origin)
  maxPrice: number | null; // 5 — lọc cứng (giá tối đa MỘT món, VND)
  wantsCheap: boolean; // 6 — ranking (cộng trọng số quán có món rẻ)
};
