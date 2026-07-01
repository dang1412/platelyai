"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { RestaurantForEdit } from "@/lib/adminRestaurant";
import { adminFetch } from "./adminFetch";

// Form thông tin quán dùng chung cho 3 luồng tạo/sửa quán:
// - "create"      : admin tạo quán → POST /api/admin/restaurants → sang trang sửa quán.
// - "create-self" : user thường tự tạo quán → POST /api/restaurants (tự thành owner) →
//                   update() session để có role owner → sang trang sửa quán nhập menu.
// - "edit"        : PATCH /api/admin/restaurants/:id rồi refresh để server component tải lại.
// Toạ độ có thể lấy tự động từ thiết bị qua Geolocation API. Style dùng semantic token vì form
// này còn render ở trang buyer-facing /restaurants/new (AGENTS §5).
type Props =
  | { mode: "create" | "create-self"; restaurant?: undefined }
  | { mode: "edit"; restaurant: RestaurantForEdit };

export default function InfoForm({ mode, restaurant }: Props) {
  const router = useRouter();
  const { update } = useSession();
  const isCreate = mode !== "edit";
  const [name, setName] = useState(restaurant?.name ?? "");
  const [address, setAddress] = useState(restaurant?.address ?? "");
  const [phone, setPhone] = useState(restaurant?.phone ?? "");
  const [website, setWebsite] = useState(restaurant?.website ?? "");
  const [lat, setLat] = useState(restaurant?.lat != null ? String(restaurant.lat) : "");
  const [lng, setLng] = useState(restaurant?.lng != null ? String(restaurant.lng) : "");

  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Nguồn toạ độ hiện tại để chú thích cạnh link Google Maps. null = có sẵn từ DB (edit) chưa rõ nguồn.
  const [coordSource, setCoordSource] = useState<"address" | "device" | null>(null);

  // Lấy toạ độ TỪ ĐỊA CHỈ TEXT qua /api/geocode (key Google nằm server-side).
  async function locateFromAddress() {
    const q = address.trim();
    if (!q) {
      setError("Nhập địa chỉ trước khi lấy toạ độ");
      return;
    }
    setGeocoding(true);
    setError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Không tìm được toạ độ cho địa chỉ này");
        return;
      }
      const coords = (await res.json()) as { lat: number; lng: number };
      setLat(String(coords.lat));
      setLng(String(coords.lng));
      setCoordSource("address");
    } catch {
      setError("Lỗi mạng khi lấy toạ độ từ địa chỉ");
    } finally {
      setGeocoding(false);
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setError("Thiết bị không hỗ trợ định vị");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setCoordSource("device");
        setLocating(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Bạn đã từ chối quyền truy cập vị trí"
            : "Không lấy được vị trí",
        );
        setLocating(false);
      },
      // Đồng bộ option với useGeolocation (search): cùng thiết bị → cùng toạ độ. Bật GPS độ
      // chính xác cao để toạ độ quán khớp origin lúc search, tránh lệch rớt khỏi bán kính lọc.
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5 * 60_000 },
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const payload = {
      name,
      address,
      phone,
      website,
      lat: lat.trim() === "" ? null : Number(lat),
      lng: lng.trim() === "" ? null : Number(lng),
    };
    try {
      if (mode === "edit") {
        await adminFetch(`/api/admin/restaurants/${restaurant.id}`, "PATCH", payload);
        setSaved(true);
        router.refresh();
        return;
      }
      // create (admin) hoặc create-self (user thường): endpoint khác nhau, đều trả { id }.
      const endpoint = mode === "create-self" ? "/api/restaurants" : "/api/admin/restaurants";
      const res = (await adminFetch(endpoint, "POST", payload)) as { id: number };
      // User self-serve vừa được nâng role owner trong DB → làm tươi session trước khi vào
      // khu quản trị, tránh admin/layout chặn vì JWT còn role cũ.
      if (mode === "create-self") await update();
      router.push(`/admin/restaurants/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  const field =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand";
  // Ô toạ độ chỉ đọc: giá trị đến từ nút lấy toạ độ (thiết bị / địa chỉ), không nhập tay.
  const coordField =
    "w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground outline-none";

  const hasCoords = lat.trim() !== "" && lng.trim() !== "";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${lat},${lng}`,
  )}`;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Tên quán
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Điện thoại
          <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Website
          <input className={field} value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      {/* Địa chỉ đặt sát khối toạ độ để tiện lấy toạ độ từ địa chỉ (geocode). */}
      <label className="flex flex-col gap-1 text-sm">
        Địa chỉ
        <input className={field} value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Vĩ độ (lat)
            <input className={coordField} value={lat} readOnly />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Kinh độ (lng)
            <input className={coordField} value={lng} readOnly />
          </label>
        </div>
        {hasCoords && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              📍 Xem trên Google Maps
            </a>
            {coordSource && (
              <span className="text-muted-foreground">
                (toạ độ lấy từ {coordSource === "address" ? "địa chỉ" : "thiết bị"})
              </span>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={locateFromAddress}
            disabled={geocoding}
            className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted disabled:opacity-50"
          >
            {geocoding ? "Đang tìm toạ độ…" : "🔎 Lấy toạ độ từ địa chỉ"}
          </button>
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted disabled:opacity-50"
          >
            {locating ? "Đang lấy vị trí…" : "📍 Lấy toạ độ từ thiết bị"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {saving
            ? isCreate
              ? "Đang tạo…"
              : "Đang lưu…"
            : isCreate
              ? "Tạo quán"
              : "Lưu thông tin"}
        </button>
        {saved && !saving && <span className="text-sm text-muted-foreground">Đã lưu</span>}
      </div>
    </form>
  );
}
