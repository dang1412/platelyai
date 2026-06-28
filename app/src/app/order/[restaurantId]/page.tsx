// /order/<id> không phải trang riêng — render thẳng trang chủ. Trang chủ đọc path /order/<id>
// để mở modal quán ở chế độ đặt món (xem page.tsx sync + RestaurantModal). Nhờ vậy link/deep-link
// /order/<id> vào đúng modal đặt món, reload cũng vào modal (không còn trang đặt món tách riêng).
export { default } from "@/app/page";
