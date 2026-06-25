import Link from "next/link";
import { getCurrentUser } from "@/lib/authz";
import InfoForm from "@/components/admin/InfoForm";

// Trang tạo quán mới — chỉ admin. Tạo xong InfoForm chuyển sang trang sửa để nhập menu.
export default async function RestaurantCreatePage() {
  const user = (await getCurrentUser())!;
  if (user.role !== "admin") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center p-6 text-center">
        <div>
          <h1 className="mb-2 text-xl font-semibold">Không có quyền</h1>
          <p className="text-sm text-black/60">Chỉ admin được tạo quán mới.</p>
          <Link href="/admin" className="mt-3 inline-block text-sm underline">
            ← Về danh sách
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <div>
        <Link href="/admin" className="text-sm text-black/60 hover:underline">
          ← Danh sách quán
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Tạo quán mới</h1>
      </div>

      <section>
        <InfoForm mode="create" />
      </section>
    </main>
  );
}
