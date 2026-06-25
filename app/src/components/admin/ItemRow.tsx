"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EditItem } from "@/lib/adminRestaurant";
import { adminFetch } from "./adminFetch";

const field =
  "rounded-lg border border-black/15 px-2.5 py-1.5 text-sm outline-none focus:border-black/40";

// Một dòng món: sửa tên/giá/mô tả/còn-hàng + Lưu/Xoá. Đổi tên reset embedding ở API.
export default function ItemRow({ item }: { item: EditItem }) {
  const router = useRouter();
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price?.toString() ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [isAvailable, setIsAvailable] = useState(item.isAvailable);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/items/${item.id}`, "PATCH", {
        name,
        price: price === "" ? null : Number(price),
        description,
        category_id: item.categoryId,
        is_available: isAvailable,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Xoá món “${item.name}”?`)) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/items/${item.id}`, "DELETE");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${field} min-w-40 flex-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên món"
        />
        <input
          className={`${field} w-28`}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Giá (VND)"
          inputMode="numeric"
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
          />
          Còn
        </label>
      </div>
      <input
        className={field}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Mô tả (tuỳ chọn)"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg border border-black/15 px-3 py-1.5 text-sm transition hover:bg-black/5 disabled:opacity-50"
        >
          Lưu
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          Xoá
        </button>
      </div>
    </div>
  );
}
