import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Guard cho toàn bộ /admin. Chạy ở Node runtime (server component) nên dùng pg được.
// Chưa đăng nhập -> /login. Đăng nhập nhưng không phải admin -> báo thiếu quyền.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role !== "admin") {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-center">
        <div>
          <h1 className="mb-2 text-xl font-semibold">Không đủ quyền</h1>
          <p className="text-sm text-black/60">
            Tài khoản {session.user.email} chưa được cấp quyền admin.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
