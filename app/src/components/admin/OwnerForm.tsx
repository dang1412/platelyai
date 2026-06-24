"use client";

import { useState } from "react";
import { adminFetch } from "./adminFetch";

// Gán chủ quán theo email (chỉ admin thấy). User phải đã từng đăng nhập.
export default function OwnerForm({ restaurantId }: { restaurantId: number }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await adminFetch(`/api/admin/restaurants/${restaurantId}/owners`, "POST", {
        email,
      });
      setEmail("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
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
      {done && <span className="text-sm text-green-600">Đã gán</span>}
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
