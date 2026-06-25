"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "./adminFetch";

// Gán / gỡ tag vibe cho quán. Tag hiện tại hiện dạng chip (× để gỡ); dropdown chọn tag
// chưa gán để thêm. Mỗi thao tác gọi API rồi router.refresh() để server tải lại danh sách.
type Tag = { id: number; name: string };
type Props = {
  restaurantId: number;
  tags: Tag[]; // tag đã gán cho quán
  allTags: Tag[]; // toàn bộ vocab (bảng tags)
};

export default function TagEditor({ restaurantId, tags, allTags }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tag còn lại để thêm (chưa gán cho quán).
  const available = useMemo(() => {
    const has = new Set(tags.map((t) => t.id));
    return allTags.filter((t) => !has.has(t.id));
  }, [tags, allTags]);

  async function mutate(method: "POST" | "DELETE", tagId: number) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/restaurants/${restaurantId}/tags`, method, {
        tagId,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  function onAdd(e: React.ChangeEvent<HTMLSelectElement>) {
    const tagId = Number(e.target.value);
    e.target.value = "";
    if (tagId > 0) mutate("POST", tagId);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {tags.length === 0 && (
          <span className="text-sm text-black/50">Chưa gán tag nào.</span>
        )}
        {tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-black/5 px-3 py-1 text-sm"
          >
            {t.name}
            <button
              type="button"
              onClick={() => mutate("DELETE", t.id)}
              disabled={busy}
              aria-label={`Gỡ tag ${t.name}`}
              className="text-black/40 transition hover:text-black/80 disabled:opacity-50"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <select
        onChange={onAdd}
        disabled={busy || available.length === 0}
        defaultValue=""
        className="w-full max-w-xs rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-50"
      >
        <option value="" disabled>
          {available.length === 0 ? "Đã gán hết tag" : "+ Thêm tag…"}
        </option>
        {available.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
