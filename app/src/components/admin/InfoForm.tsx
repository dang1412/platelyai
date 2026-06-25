"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RestaurantForEdit } from "@/lib/adminRestaurant";
import { adminFetch } from "./adminFetch";

// Form thông tin quán dùng chung cho TẠO (mode="create") và SỬA (mode="edit").
// - create: POST /api/admin/restaurants rồi chuyển sang trang sửa quán vừa tạo.
// - edit:   PATCH /api/admin/restaurants/:id rồi refresh để server component tải lại.
// Toạ độ có thể lấy tự động từ thiết bị qua Geolocation API.
type Props =
  | { mode: "create"; restaurant?: undefined }
  | { mode: "edit"; restaurant: RestaurantForEdit };

export default function InfoForm({ mode, restaurant }: Props) {
  const router = useRouter();
  const [name, setName] = useState(restaurant?.name ?? "");
  const [address, setAddress] = useState(restaurant?.address ?? "");
  const [phone, setPhone] = useState(restaurant?.phone ?? "");
  const [website, setWebsite] = useState(restaurant?.website ?? "");
  const [servesFood, setServesFood] = useState(restaurant?.servesFood ?? false);
  const [servesDrink, setServesDrink] = useState(restaurant?.servesDrink ?? false);
  const [lat, setLat] = useState(restaurant?.lat != null ? String(restaurant.lat) : "");
  const [lng, setLng] = useState(restaurant?.lng != null ? String(restaurant.lng) : "");

  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
      serves_food: servesFood,
      serves_drink: servesDrink,
      lat: lat.trim() === "" ? null : Number(lat),
      lng: lng.trim() === "" ? null : Number(lng),
    };
    try {
      if (mode === "create") {
        const res = (await adminFetch("/api/admin/restaurants", "POST", payload)) as {
          id: number;
        };
        router.push(`/admin/restaurants/${res.id}`);
        return;
      }
      await adminFetch(`/api/admin/restaurants/${restaurant.id}`, "PATCH", payload);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  const field =
    "w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Tên quán
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Địa chỉ
        <input className={field} value={address} onChange={(e) => setAddress(e.target.value)} />
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

      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Vĩ độ (lat)
            <input className={field} value={lat} onChange={(e) => setLat(e.target.value)} />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Kinh độ (lng)
            <input className={field} value={lng} onChange={(e) => setLng(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="self-start rounded-lg border border-black/15 px-3 py-2 text-sm transition hover:bg-black/5 disabled:opacity-50"
        >
          {locating ? "Đang lấy vị trí…" : "📍 Lấy toạ độ từ thiết bị"}
        </button>
      </div>

      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={servesFood}
            onChange={(e) => setServesFood(e.target.checked)}
          />
          Phục vụ đồ ăn
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={servesDrink}
            onChange={(e) => setServesDrink(e.target.checked)}
          />
          Phục vụ đồ uống
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/85 disabled:opacity-50"
        >
          {saving
            ? mode === "create"
              ? "Đang tạo…"
              : "Đang lưu…"
            : mode === "create"
              ? "Tạo quán"
              : "Lưu thông tin"}
        </button>
        {saved && !saving && <span className="text-sm text-green-600">Đã lưu</span>}
      </div>
    </form>
  );
}
