// Tóm tắt nội dung đơn — danh sách món × SL, tổng tiền, kiểu nhận hàng, SDT.
// Presentational thuần: đơn đã lưu sẵn toạ độ giao → mở bản đồ thẳng theo toạ độ (không geocode lại).

import type { Fulfillment, OrderItem } from "@/lib/orders/types";

// Định dạng giá VND (như RestaurantModal).
function formatPrice(price: number): string {
  return `${price.toLocaleString("vi-VN")} đ`;
}

type Props = {
  items: OrderItem[];
  total: number;
  fulfillment: Fulfillment;
  phone: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export function OrderSummary({
  items,
  total,
  fulfillment,
  phone,
  address,
  lat,
  lng,
}: Props) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      {/* Danh sách món */}
      <ul className="flex flex-col gap-2">
        {items.map((it, idx) => (
          <li key={idx} className="flex justify-between gap-3 text-sm">
            <span className="text-foreground">
              {it.name} <span className="text-muted-foreground">× {it.quantity}</span>
            </span>
            <span className="text-foreground">{formatPrice(it.price * it.quantity)}</span>
          </li>
        ))}
      </ul>

      {/* Tổng tiền */}
      <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
        <span className="text-foreground">Tổng cộng</span>
        <span className="text-brand">{formatPrice(total)}</span>
      </div>

      {/* Thông tin nhận hàng */}
      <dl className="mt-4 flex flex-col gap-1 text-sm text-muted-foreground">
        <div className="flex gap-2">
          <dt>Nhận hàng:</dt>
          <dd className="text-foreground">
            {fulfillment === "delivery" ? "Giao tới địa chỉ" : "Lấy tại quầy"}
          </dd>
        </div>
        {fulfillment === "delivery" && address && (
          <div className="flex gap-2">
            <dt>Địa chỉ:</dt>
            <dd className="text-foreground">
              {address}
              {lat != null && lng != null && (
                <>
                  {" "}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap text-brand hover:underline"
                  >
                    Mở bản đồ ↗
                  </a>
                </>
              )}
            </dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt>Điện thoại:</dt>
          <dd className="text-foreground">{phone}</dd>
        </div>
      </dl>
    </div>
  );
}
