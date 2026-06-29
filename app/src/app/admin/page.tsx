import Link from "next/link";
import { getCurrentUser, listEditableRestaurants } from "@/lib/authz";

// Danh sách quán quản lý + ô search lọc tên (server-side, không cần client state).
// Quyền đã kiểm ở admin/layout.tsx; phạm vi quán theo role kiểm trong listEditableRestaurants.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const user = (await getCurrentUser())!;
  const restaurants = await listEditableRestaurants(user, q);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Quản lý quán</h1>
        <p className="text-sm text-black/60">
          {user.name ?? user.email}
          {user.role === "admin" && (
            <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs">
              admin · tất cả quán
            </span>
          )}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          className="self-start rounded-lg border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/5"
        >
          Quản lý đơn
        </Link>
        {user.role === "admin" && (
          <Link
            href="/admin/restaurants/new"
            className="self-start rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/85"
          >
            + Tạo quán
          </Link>
        )}
      </div>

      <form method="get" className="mb-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Tìm theo tên quán…"
          className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40"
        />
        <button
          type="submit"
          className="rounded-lg border border-black/15 px-4 py-2 text-sm transition hover:bg-black/5"
        >
          Tìm
        </button>
      </form>

      {restaurants.length === 0 ? (
        <p className="rounded-xl border border-black/10 p-6 text-sm text-black/60">
          {q ? `Không tìm thấy quán khớp “${q}”.` : "Chưa có quán nào."}
        </p>
      ) : (
        <ul className="divide-y divide-black/10 rounded-xl border border-black/10">
          {restaurants.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/restaurants/${r.id}`}
                className="flex flex-col gap-0.5 px-4 py-3 transition hover:bg-black/5"
              >
                <span className="font-medium">{r.name}</span>
                {r.address && (
                  <span className="text-sm text-black/60">{r.address}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
