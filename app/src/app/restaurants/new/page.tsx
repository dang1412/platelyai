import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/authz";
import SiteHeader from "@/components/SiteHeader";
import InfoForm from "@/components/admin/InfoForm";

// Trang tạo quán self-serve cho user thường (plan 17). Chưa đăng nhập -> /login. Người tạo tự
// thành chủ quán; tạo xong form chuyển sang trang sửa quán để nhập menu.
export default async function NewRestaurantPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <SiteHeader />
      <h1 className="mb-1 text-xl font-semibold">Tạo quán mới</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Bạn sẽ là chủ quán này và có thể nhập menu ngay sau khi tạo.
      </p>
      <InfoForm mode="create-self" />
    </main>
  );
}
