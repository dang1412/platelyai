"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EditCategory, MenuKind } from "@/lib/adminRestaurant";
import { adminFetch } from "./adminFetch";
import CategoryBlock from "./CategoryBlock";

const field =
  "rounded-lg border border-black/15 px-2.5 py-1.5 text-sm outline-none focus:border-black/40";

// Khu vực sửa menu: danh sách nhóm (mỗi nhóm tự quản món) + form thêm nhóm. Mọi thay đổi
// gọi API rồi router.refresh() để tải lại dữ liệu server (không giữ state mảng phức tạp).
export default function MenuEditor({
  restaurantId,
  categories,
}: {
  restaurantId: number;
  categories: EditCategory[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"" | MenuKind>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/restaurants/${restaurantId}/categories`, "POST", {
        category_name: name,
        kind: kind || null,
        display_order: categories.length,
      });
      setName("");
      setKind("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {categories.map((c) => (
        <CategoryBlock key={c.id} restaurantId={restaurantId} category={c} />
      ))}
      {categories.length === 0 && (
        <p className="text-sm text-black/40">Chưa có nhóm menu nào.</p>
      )}

      <form
        onSubmit={addCategory}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-black/20 p-3"
      >
        <input
          className={`${field} min-w-40 flex-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên nhóm mới (vd: Đồ uống)…"
          required
        />
        <select
          className={field}
          value={kind}
          onChange={(e) => setKind(e.target.value as "" | MenuKind)}
        >
          <option value="">Loại —</option>
          <option value="food">Đồ ăn</option>
          <option value="drink">Đồ uống</option>
          <option value="other">Khác</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black/85 disabled:opacity-50"
        >
          Thêm nhóm
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
