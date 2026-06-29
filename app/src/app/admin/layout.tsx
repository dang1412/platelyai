import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SiteHeader from "@/components/SiteHeader";

// Guard cho toàn bộ /admin. Chạy ở Node runtime (server component) nên dùng pg được.
// Chưa đăng nhập -> /login. Vào được nếu role ∈ {admin, owner}; user thường -> báo thiếu quyền.
// Phân quyền theo TỪNG quán nằm ở lib/authz.ts (canEdit/assertCanEdit).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role !== "admin" && role !== "owner") {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-center">
        <div>
          <h1 className="mb-2 text-xl font-semibold">Không đủ quyền</h1>
          <p className="text-sm text-black/60">
            Tài khoản {session.user.email} chưa được cấp quyền quản trị.
          </p>
        </div>
      </main>
    );
  }

  // Header chung cho toàn khu admin (logo + menu user). Mỗi page tự render <main> bên dưới.
  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-6 pt-6">
        <SiteHeader />
      </div>
      {children}
    </>
  );
}
