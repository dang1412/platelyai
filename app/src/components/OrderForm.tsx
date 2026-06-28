// Form đặt món phía buyer (feature 11 — UI mock): chọn món + số lượng, kiểu nhận hàng,
// địa chỉ/SDT, ghi chú. Validate phía UI trước khi submit; submit gọi `onSubmit(draft)`.
// "use client" — có state + geolocation. Validate/persist thật ở plan 10.

"use client";

import { useMemo, useState } from "react";
import { haversineMeters } from "@/lib/geo";
import type { Fulfillment, OrderItem } from "@/lib/orders/types";
import type { LatLng, MenuCategory } from "@/lib/types";

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
  restaurantCoords?: LatLng | null; // toạ độ quán để gate bán kính giao
  onSubmit: (draft: OrderDraft) => void;
  onCancel: () => void;
};

function formatPrice(price: number): string {
  return `${price.toLocaleString("vi-VN")} đ`;
}

// SDT VN: 10 số bắt đầu bằng 0.
const PHONE_RE = /^0\d{9}$/;
// Bán kính giao tối đa (mét).
const MAX_DELIVERY_M = 1000;

export function OrderForm({
  restaurantName,
  menu,
  restaurantCoords,
  onSubmit,
  onCancel,
}: Props) {
  // Gom theo category, chỉ giữ món có giá (mới đặt được); key ổn định theo vị trí.
  const groups = useMemo(
    () =>
      menu
        .map((cat, ci) => ({
          name: cat.categoryName,
          rows: cat.items
            .filter((it) => it.price != null)
            .map((it, ii) => ({ key: `${ci}-${ii}`, name: it.name, price: it.price as number })),
        }))
        .filter((g) => g.rows.length > 0),
    [menu],
  );
  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  // Kiểm tra địa chỉ qua Google (geocode) — toạ độ + lỗi.
  const [geo, setGeo] = useState<LatLng | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const setQ = (key: string, next: number) =>
    setQty((q) => ({ ...q, [key]: Math.max(0, next) }));

  // Đổi địa chỉ → kết quả kiểm tra cũ không còn đúng, reset.
  const onAddressChange = (value: string) => {
    setAddress(value);
    setGeo(null);
    setGeoErr(null);
  };

  // Gọi /api/geocode để lấy toạ độ từ địa chỉ đã nhập.
  const checkAddress = async () => {
    const q = address.trim();
    if (!q) return;
    setChecking(true);
    setGeo(null);
    setGeoErr(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setGeoErr(data?.error ?? "Không kiểm tra được địa chỉ.");
        return;
      }
      setGeo((await res.json()) as LatLng);
    } catch {
      setGeoErr("Lỗi mạng khi kiểm tra địa chỉ.");
    } finally {
      setChecking(false);
    }
  };


  const selected: OrderItem[] = rows
    .filter((r) => (qty[r.key] ?? 0) > 0)
    .map((r) => ({ name: r.name, price: r.price, quantity: qty[r.key] }));
  const total = selected.reduce((s, it) => s + it.price * it.quantity, 0);

  // Khoảng cách tới quán (m) khi đã geocode được địa chỉ + biết toạ độ quán.
  const distanceM =
    geo && restaurantCoords ? haversineMeters(geo, restaurantCoords) : null;
  const tooFar = distanceM != null && distanceM > MAX_DELIVERY_M;

  // Lỗi field địa chỉ (chỉ với giao tận nơi): bắt buộc geocode + trong bán kính giao.
  const addressError = (): string | null => {
    if (fulfillment !== "delivery") return null;
    if (address.trim() === "") return "Nhập địa chỉ giao hàng.";
    if (!geo) return "Bấm “Kiểm tra địa chỉ” để xác định toạ độ trước khi đặt.";
    if (distanceM == null) return "Không xác định được khoảng cách tới quán.";
    if (tooFar)
      return `Ngoài bán kính giao 1km (cách ${(distanceM / 1000).toFixed(1)} km).`;
    return null;
  };

  const errors = {
    items: selected.length === 0 ? "Chọn ít nhất 1 món." : null,
    phone: !PHONE_RE.test(phone) ? "Số điện thoại không hợp lệ (10 số, bắt đầu 0)." : null,
    address: addressError(),
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
      {/* Chọn món — gom theo category */}
      <section className="flex flex-col gap-4">
        <h4 className="text-sm font-semibold text-foreground">Chọn món</h4>
        {groups.map((g) => (
          <div key={g.name}>
            <p className="mb-2 border-b border-border pb-1 text-sm font-bold text-foreground">
              {g.name}
            </p>
            <ul className="flex flex-col gap-2">
              {g.rows.map((r) => (
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
          </div>
        ))}
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
          <label className="mb-1 block text-sm font-semibold text-foreground">
            Địa chỉ giao
          </label>
          <input
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="Số nhà, đường, phường…"
            className={inputClass}
          />
          {showErrors && errors.address && <p className={errClass}>{errors.address}</p>}

          {/* Kiểm tra địa chỉ qua Google Maps */}
          <div className="mt-2 flex flex-col gap-1">
            <button
              type="button"
              onClick={checkAddress}
              disabled={checking || address.trim() === ""}
              className="self-start rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checking ? "Đang kiểm tra…" : "Kiểm tra địa chỉ"}
            </button>
            {geoErr && <p className={errClass}>{geoErr}</p>}
            {geo && (
              <p className={`text-xs ${tooFar ? "text-brand" : "text-success"}`}>
                {distanceM == null
                  ? "✓ Đã xác định toạ độ"
                  : tooFar
                    ? `⚠︎ Cách quán ${(distanceM / 1000).toFixed(1)} km — ngoài bán kính giao 1km`
                    : `✓ Cách quán ${(distanceM / 1000).toFixed(2)} km`}{" "}
                ·{" "}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:underline"
                >
                  Mở trên Google Maps ↗
                </a>
              </p>
            )}
          </div>
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
      {/* Gợi ý mờ giải thích vì sao nút đang bị khoá. */}
      {!valid && (
        <p className="text-center text-xs text-muted-foreground">
          {errors.items ?? errors.address ?? errors.phone}
        </p>
      )}
    </div>
  );
}
