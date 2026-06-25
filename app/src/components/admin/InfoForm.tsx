"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RestaurantForEdit } from "@/lib/adminRestaurant";
import { adminFetch } from "./adminFetch";

// Form sửa thông tin quán. Lưu qua PATCH /api/admin/restaurants/:id rồi refresh để
// server component tải lại dữ liệu mới.
export default function InfoForm({ restaurant }: { restaurant: RestaurantForEdit }) {
  const router = useRouter();
  const [name, setName] = useState(restaurant.name);
  const [address, setAddress] = useState(restaurant.address ?? "");
  const [phone, setPhone] = useState(restaurant.phone ?? "");
  const [website, setWebsite] = useState(restaurant.website ?? "");
  const [servesFood, setServesFood] = useState(restaurant.servesFood ?? false);
  const [servesDrink, setServesDrink] = useState(restaurant.servesDrink ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await adminFetch(`/api/admin/restaurants/${restaurant.id}`, "PATCH", {
        name,
        address,
        phone,
        website,
        serves_food: servesFood,
        serves_drink: servesDrink,
      });
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
          {saving ? "Đang lưu…" : "Lưu thông tin"}
        </button>
        {saved && !saving && <span className="text-sm text-green-600">Đã lưu</span>}
      </div>
    </form>
  );
}
