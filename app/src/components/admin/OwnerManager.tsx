"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Owner } from "@/lib/owners";
import { adminFetch } from "./adminFetch";

// Quản lý chủ quán (chỉ admin thấy): list owner hiện tại + gỡ, và form gán thêm theo email.
// Sau mỗi mutation gọi router.refresh() để RSC tải lại list (không tự quản state list ở client).
export default function OwnerManager({
  restaurantId,
  owners,
}: {
  restaurantId: number;
  owners: Owner[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onAssign(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/restaurants/${restaurantId}/owners`, "POST", {
        email,
      });
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(userId: number) {
    setRemovingId(userId);
    setError(null);
    try {
      await adminFetch(`/api/admin/restaurants/${restaurantId}/owners`, "DELETE", {
        userId,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {owners.length === 0 ? (
        <p className="text-sm text-black/60">Chưa có chủ quán.</p>
      ) : (
        <ul className="divide-y divide-black/10 rounded-lg border border-black/10">
          {owners.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {o.name ?? o.email}
                </span>
                {o.name && (
                  <span className="block truncate text-xs text-black/60">
                    {o.email}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onRemove(o.id)}
                disabled={removingId === o.id}
                className="shrink-0 rounded-lg border border-black/15 px-3 py-1 text-sm text-red-600 transition hover:bg-red-600/5 disabled:opacity-50"
              >
                {removingId === o.id ? "Đang gỡ…" : "Gỡ"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAssign} className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          className="min-w-48 flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@gmail.com"
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg border border-black/15 px-4 py-2 text-sm transition hover:bg-black/5 disabled:opacity-50"
        >
          Gán chủ quán
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
