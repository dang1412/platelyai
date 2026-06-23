import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

// Trang đăng nhập — giai đoạn 1 chỉ có Google. Đã đăng nhập thì chuyển thẳng vào /admin.
export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/admin");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">Đăng nhập Plately</h1>
        <p className="mb-6 text-sm text-black/60">
          Dùng tài khoản Google để vào trang quản trị.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/admin" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black/85"
          >
            Tiếp tục với Google
          </button>
        </form>
      </div>
    </main>
  );
}
