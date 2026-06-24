import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, canEdit } from "@/lib/authz";
import { getRestaurantForEdit } from "@/lib/adminRestaurant";
import InfoForm from "@/components/admin/InfoForm";
import MenuEditor from "@/components/admin/MenuEditor";
import OwnerForm from "@/components/admin/OwnerForm";

// Trang sửa một quán: thông tin + menu (+ gán owner nếu admin). Quyền theo từng quán.
export default async function RestaurantEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const restaurantId = Number(id);
  if (!Number.isInteger(restaurantId) || restaurantId <= 0) notFound();

  const user = (await getCurrentUser())!;
  if (!(await canEdit(user, restaurantId))) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center p-6 text-center">
        <div>
          <h1 className="mb-2 text-xl font-semibold">Không có quyền</h1>
          <p className="text-sm text-black/60">Bạn không sở hữu quán này.</p>
          <Link href="/admin" className="mt-3 inline-block text-sm underline">
            ← Về danh sách
          </Link>
        </div>
      </main>
    );
  }

  const data = await getRestaurantForEdit(restaurantId);
  if (!data) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <div>
        <Link href="/admin" className="text-sm text-black/60 hover:underline">
          ← Danh sách quán
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{data.name}</h1>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Thông tin quán</h2>
        <InfoForm restaurant={data} />
      </section>

      {user.role === "admin" && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">Chủ quán</h2>
          <p className="mb-3 text-sm text-black/60">
            Gán quyền quản lý quán này cho một tài khoản đã đăng nhập.
          </p>
          <OwnerForm restaurantId={data.id} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Menu</h2>
        <MenuEditor restaurantId={data.id} categories={data.categories} />
      </section>
    </main>
  );
}
