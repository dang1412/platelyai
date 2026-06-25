"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "./adminFetch";

// Sửa điểm + số lượt đánh giá của quán (chỉ admin thấy). PATCH route admin-only,
// rồi refresh để server component tải lại giá trị mới.
type Props = {
  restaurantId: number;
  rating: string | null;
  ratingCount: number | null;
};

export default function RatingForm({ restaurantId, rating, ratingCount }: Props) {
  const router = useRouter();
  const [ratingStr, setRatingStr] = useState(rating ?? "");
  const [countStr, setCountStr] = useState(ratingCount != null ? String(ratingCount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await adminFetch(`/api/admin/restaurants/${restaurantId}/rating`, "PATCH", {
        rating: ratingStr.trim() === "" ? null : Number(ratingStr),
        rating_count: countStr.trim() === "" ? null : Number(countStr),
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
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Điểm đánh giá (0–5)
          <input
            className={field}
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={ratingStr}
            onChange={(e) => setRatingStr(e.target.value)}
            placeholder="vd: 4.5"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Số lượt đánh giá
          <input
            className={field}
            type="number"
            min={0}
            step={1}
            value={countStr}
            onChange={(e) => setCountStr(e.target.value)}
            placeholder="vd: 1200"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/85 disabled:opacity-50"
        >
          {saving ? "Đang lưu…" : "Lưu đánh giá"}
        </button>
        {saved && !saving && <span className="text-sm text-green-600">Đã lưu</span>}
      </div>
    </form>
  );
}
