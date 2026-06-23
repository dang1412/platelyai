import { auth, signOut } from "@/auth";

// Dashboard admin (placeholder giai đoạn 1). Quyền đã được kiểm ở admin/layout.tsx.
export default async function AdminPage() {
  const session = await auth();
  const user = session!.user;

  return (
    <main className="flex flex-1 flex-col p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Trang quản trị</h1>
          <p className="text-sm text-black/60">
            {user.name} · {user.email} · role: {user.role}
          </p>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-black/15 px-4 py-2 text-sm transition hover:bg-black/5"
          >
            Đăng xuất
          </button>
        </form>
      </header>

      <div className="rounded-xl border border-black/10 p-6 text-sm text-black/60">
        Chỗ này sẽ là quản lý quán / nhận đặt món ở các giai đoạn sau.
      </div>
    </main>
  );
}
