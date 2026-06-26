"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ParsedMenu } from "@/lib/menuParse";
import { adminFetch } from "./adminFetch";

const field =
  "rounded-lg border border-black/15 px-2.5 py-1.5 text-sm outline-none focus:border-black/40";

// Preview ở client cho phép sửa giá dạng chuỗi trước khi gửi.
type DraftItem = { name: string; price: string; description: string };
type DraftCategory = { categoryName: string; items: DraftItem[] };

function toDraft(menu: ParsedMenu): DraftCategory[] {
  return menu.categories.map((c) => ({
    categoryName: c.categoryName,
    items: c.items.map((i) => ({
      name: i.name,
      price: i.price?.toString() ?? "",
      description: i.description ?? "",
    })),
  }));
}

// Nhập menu từ ảnh: upload → /menu/parse (Gemini Vision) → preview sửa được → /menu/import (merge).
export default function MenuImport({ restaurantId }: { restaurantId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [draft, setDraft] = useState<DraftCategory[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function patchItem(ci: number, ii: number, patch: Partial<DraftItem>) {
    setDraft((d) =>
      d!.map((c, x) =>
        x !== ci ? c : { ...c, items: c.items.map((it, y) => (y !== ii ? it : { ...it, ...patch })) },
      ),
    );
  }
  function removeItem(ci: number, ii: number) {
    setDraft((d) => d!.map((c, x) => (x !== ci ? c : { ...c, items: c.items.filter((_, y) => y !== ii) })));
  }

  async function parse(e: React.FormEvent) {
    e.preventDefault();
    if (!files || files.length === 0) return;
    setParsing(true);
    setError(null);
    setDone(null);
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("images", f));
      const menu = (await adminFetch(
        `/api/admin/restaurants/${restaurantId}/menu/parse`,
        "POST",
        form,
      )) as ParsedMenu;
      setDraft(toDraft(menu));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setParsing(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const categories = draft!
        .filter((c) => c.items.length > 0)
        .map((c, ci) => ({
          category_name: c.categoryName,
          display_order: ci,
          items: c.items.map((i) => ({
            name: i.name,
            price: i.price.trim() === "" ? null : Number(i.price.replace(/[^\d]/g, "")),
            description: i.description.trim() || null,
          })),
        }));
      const res = (await adminFetch(
        `/api/admin/restaurants/${restaurantId}/menu/import`,
        "POST",
        { categories },
      )) as { itemsInserted: number; itemsUpdated: number };
      setDone(`Đã thêm ${res.itemsInserted}, cập nhật ${res.itemsUpdated} món.`);
      setDraft(null);
      setFiles(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start rounded-lg border border-black/15 px-3 py-1.5 text-sm transition hover:bg-black/5"
      >
        + Nhập menu từ ảnh
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-black/15 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Nhập menu từ ảnh</span>
        <button onClick={() => setOpen(false)} className="text-sm text-black/50 hover:underline">
          Đóng
        </button>
      </div>

      <form onSubmit={parse} className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles(e.target.files)}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={parsing || !files?.length}
          className="rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black/85 disabled:opacity-50"
        >
          {parsing ? "Đang đọc ảnh…" : "Đọc menu"}
        </button>
        <span className="text-xs text-black/40">Tối đa 4 ảnh, JPEG/PNG/WebP ≤ 5MB.</span>
      </form>

      {done && <p className="text-sm text-green-700">{done}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {draft && (
        <div className="flex flex-col gap-3">
          {draft.map((c, ci) => (
            <div key={ci} className="flex flex-col gap-2 rounded-lg border border-black/10 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={`${field} min-w-40 flex-1 font-medium`}
                  value={c.categoryName}
                  onChange={(e) =>
                    setDraft((d) => d!.map((x, i) => (i !== ci ? x : { ...x, categoryName: e.target.value })))
                  }
                  placeholder="Tên nhóm"
                />
              </div>
              {c.items.map((it, ii) => (
                <div key={ii} className="flex flex-wrap items-center gap-2">
                  <input
                    className={`${field} min-w-40 flex-1`}
                    value={it.name}
                    onChange={(e) => patchItem(ci, ii, { name: e.target.value })}
                    placeholder="Tên món"
                  />
                  <input
                    className={`${field} w-28`}
                    value={it.price}
                    onChange={(e) => patchItem(ci, ii, { price: e.target.value })}
                    placeholder="Giá (VND)"
                    inputMode="numeric"
                  />
                  <input
                    className={`${field} min-w-40 flex-1`}
                    value={it.description}
                    onChange={(e) => patchItem(ci, ii, { description: e.target.value })}
                    placeholder="Mô tả"
                  />
                  <button
                    onClick={() => removeItem(ci, ii)}
                    className="rounded-lg border border-red-300 px-2 py-1.5 text-sm text-red-600 transition hover:bg-red-50"
                  >
                    Xoá
                  </button>
                </div>
              ))}
            </div>
          ))}
          <button
            onClick={save}
            disabled={saving}
            className="self-start rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black/85 disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Lưu menu"}
          </button>
        </div>
      )}
    </div>
  );
}
