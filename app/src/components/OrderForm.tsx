// Form đặt món phía buyer (feature 11 — UI mock): chọn món + số lượng, kiểu nhận hàng,
// địa chỉ/SDT, ghi chú. Validate phía UI trước khi submit; submit gọi `onSubmit(draft)`.
// "use client" — có state + geolocation. Validate/persist thật ở plan 10.

"use client";

import { useMemo, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { Fulfillment, OrderItem } from "@/lib/orders/types";
import type { MenuCategory } from "@/lib/types";

// Dữ liệu đơn buyer nhập (plan 10 sẽ POST payload này lên API).
export type OrderDraft = {
  restaurantName: string;
  fulfillment: Fulfillment;
  items: OrderItem[];
  total: number;
  phone: string;
  address?: string | null;
  note?: string | null;
};

type Props = {
  restaurantName: string;
  menu: MenuCategory[];
  onSubmit: (draft: OrderDraft) => void;
  onCancel: () => void;
};

function formatPrice(price: number): string {
  return `${price.toLocaleString("vi-VN")} đ`;
}

// SDT VN: 10 số bắt đầu bằng 0.
const PHONE_RE = /^0\d{9}$/;

export function OrderForm({ restaurantName, menu, onSubmit, onCancel }: Props) {
  // Chỉ món có giá mới đặt được; phẳng menu thành danh sách dòng có key ổn định.
  const rows = useMemo(
    () =>
      menu.flatMap((cat, ci) =>
        cat.items
          .filter((it) => it.price != null)
          .map((it, ii) => ({ key: `${ci}-${ii}`, name: it.name, price: it.price as number })),
      ),
    [menu],
  );

  const [qty, setQty] = useState<Record<string, number>>({});
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const { coords, status, request } = useGeolocation();

  const setQ = (key: string, next: number) =>
    setQty((q) => ({ ...q, [key]: Math.max(0, next) }));

  // Điền toạ độ vào ô địa chỉ khi có (chưa reverse-geocode ở bản mock).
  const useCurrentLocation = () => {
    request();
    if (coords) setAddress(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
  };

  const selected: OrderItem[] = rows
    .filter((r) => (qty[r.key] ?? 0) > 0)
    .map((r) => ({ name: r.name, price: r.price, quantity: qty[r.key] }));
  const total = selected.reduce((s, it) => s + it.price * it.quantity, 0);

  const errors = {
    items: selected.length === 0 ? "Chọn ít nhất 1 món." : null,
    phone: !PHONE_RE.test(phone) ? "Số điện thoại không hợp lệ (10 số, bắt đầu 0)." : null,
    address:
      fulfillment === "delivery" && address.trim() === "" ? "Nhập địa chỉ giao hàng." : null,
  };
  const valid = !errors.items && !errors.phone && !errors.address;

  const submit = () => {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    onSubmit({
      restaurantName,
      fulfillment,
      items: selected,
      total,
      phone: phone.trim(),
      address: fulfillment === "delivery" ? address.trim() : null,
      note: note.trim() || null,
    });
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand";
  const errClass = "mt-1 text-xs text-brand";

  return (
    <div className="flex flex-col gap-5">
      {/* Chọn món */}
      <section>
        <h4 className="mb-2 text-sm font-semibold text-foreground">Chọn món</h4>
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate text-foreground">{r.name}</p>
                <p className="text-muted-foreground">{formatPrice(r.price)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-label="Giảm"
                  onClick={() => setQ(r.key, (qty[r.key] ?? 0) - 1)}
                  className="size-7 rounded-full border border-border text-muted-foreground hover:bg-surface-muted"
                >
                  −
                </button>
                <span className="w-5 text-center text-foreground">{qty[r.key] ?? 0}</span>
                <button
                  type="button"
                  aria-label="Tăng"
                  onClick={() => setQ(r.key, (qty[r.key] ?? 0) + 1)}
                  className="size-7 rounded-full border border-border text-muted-foreground hover:bg-surface-muted"
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
        {showErrors && errors.items && <p className={errClass}>{errors.items}</p>}
      </section>

      {/* Tổng tiền */}
      <div className="flex justify-between border-y border-border py-3 text-sm font-semibold">
        <span className="text-foreground">Tổng cộng</span>
        <span className="text-brand">{formatPrice(total)}</span>
      </div>

      {/* Kiểu nhận hàng */}
      <section className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-foreground">Nhận hàng</h4>
        <div className="flex gap-2">
          {(["delivery", "pickup"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFulfillment(f)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                fulfillment === f
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:bg-surface-muted"
              }`}
            >
              {f === "delivery" ? "Giao tận nơi" : "Lấy tại quầy"}
            </button>
          ))}
        </div>
      </section>

      {/* Địa chỉ (chỉ delivery) */}
      {fulfillment === "delivery" && (
        <section>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-semibold text-foreground">Địa chỉ giao</label>
            <button
              type="button"
              onClick={useCurrentLocation}
              className="text-xs text-brand hover:underline"
            >
              {status === "prompting" ? "Đang định vị…" : "📍 Dùng vị trí hiện tại"}
            </button>
          </div>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Số nhà, đường, phường…"
            className={inputClass}
          />
          {showErrors && errors.address && <p className={errClass}>{errors.address}</p>}
        </section>
      )}

      {/* SDT */}
      <section>
        <label className="mb-1 block text-sm font-semibold text-foreground">Số điện thoại</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="numeric"
          placeholder="0901234567"
          className={inputClass}
        />
        {showErrors && errors.phone && <p className={errClass}>{errors.phone}</p>}
      </section>

      {/* Ghi chú */}
      <section>
        <label className="mb-1 block text-sm font-semibold text-foreground">Ghi chú (tuỳ chọn)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Ít cay, giao giờ trưa…"
          className={inputClass}
        />
      </section>

      {/* Hành động */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-muted"
        >
          Huỷ
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Đặt món · {formatPrice(total)}
        </button>
      </div>
    </div>
  );
}
