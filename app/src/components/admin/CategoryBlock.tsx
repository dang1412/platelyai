"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EditCategory, MenuKind } from "@/lib/adminRestaurant";
import { adminFetch } from "./adminFetch";
import ItemRow from "./ItemRow";

const field =
  "rounded-lg border border-black/15 px-2.5 py-1.5 text-sm outline-none focus:border-black/40";

const KINDS: { value: "" | MenuKind; label: string }[] = [
  { value: "", label: "—" },
  { value: "food", label: "Đồ ăn" },
  { value: "drink", label: "Đồ uống" },
  { value: "other", label: "Khác" },
];

// Một nhóm menu: sửa/xoá nhóm + danh sách món + thêm món. id=0 là nhóm ảo "chưa phân loại"
// (món category_id NULL) — chỉ liệt kê, không sửa/thêm.
export default function CategoryBlock({
  restaurantId,
  category,
}: {
  restaurantId: number;
  category: EditCategory;
}) {
  const router = useRouter();
  const virtual = category.id === 0;

  const [name, setName] = useState(category.categoryName);
  const [kind, setKind] = useState<"" | MenuKind>(category.kind ?? "");
  const [order, setOrder] = useState(category.displayOrder.toString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form thêm món
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  async function saveCategory() {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/categories/${category.id}`, "PATCH", {
        category_name: name,
        kind: kind || null,
        display_order: order === "" ? 0 : Number(order),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory() {
    if (!confirm(`Xoá nhóm “${category.categoryName}”? Món trong nhóm sẽ về "chưa phân loại".`))
      return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/categories/${category.id}`, "DELETE");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
      setBusy(false);
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/restaurants/${restaurantId}/items`, "POST", {
        name: newName,
        price: newPrice === "" ? null : Number(newPrice),
        category_id: category.id,
      });
      setNewName("");
      setNewPrice("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-black/10 p-3">
      {virtual ? (
        <h3 className="mb-2 font-medium text-black/60">{category.categoryName}</h3>
      ) : (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            className={`${field} min-w-40 flex-1 font-medium`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value as "" | MenuKind)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            className={`${field} w-20`}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            inputMode="numeric"
            title="Thứ tự hiển thị"
          />
          <button
            onClick={saveCategory}
            disabled={busy}
            className="rounded-lg border border-black/15 px-3 py-1.5 text-sm transition hover:bg-black/5 disabled:opacity-50"
          >
            Lưu nhóm
          </button>
          <button
            onClick={removeCategory}
            disabled={busy}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            Xoá nhóm
          </button>
        </div>
      )}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2">
        {category.items.map((it) => (
          <ItemRow key={it.id} item={it} />
        ))}
        {category.items.length === 0 && (
          <p className="text-sm text-black/40">Chưa có món.</p>
        )}
      </div>

      {!virtual && (
        <form onSubmit={addItem} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className={`${field} min-w-40 flex-1`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Thêm món mới…"
            required
          />
          <input
            className={`${field} w-28`}
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="Giá (VND)"
            inputMode="numeric"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black/85 disabled:opacity-50"
          >
            Thêm món
          </button>
        </form>
      )}
    </section>
  );
}
