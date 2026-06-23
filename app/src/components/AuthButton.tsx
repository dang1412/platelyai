"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";

// Nút đăng nhập / avatar cho header. Dùng useSession (cần SessionProvider ở layout).
export default function AuthButton() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  if (status === "loading") {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />;
  }

  if (!session?.user) {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
      >
        Đăng nhập
      </button>
    );
  }

  const user = session.user;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-zinc-200 py-1 pl-1 pr-3 transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name ?? "avatar"}
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-300 text-xs font-medium dark:bg-zinc-600">
            {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <span className="max-w-[8rem] truncate text-sm">{user.name ?? user.email}</span>
      </button>

      {open && (
        <>
          {/* nền bấm ra ngoài để đóng menu */}
          <button
            type="button"
            aria-label="Đóng menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-4 py-2 text-zinc-500 dark:border-zinc-800">
              {user.email}
            </div>
            {user.role === "admin" && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Trang quản trị
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut()}
              className="block w-full px-4 py-2 text-left text-red-600 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Đăng xuất
            </button>
          </div>
        </>
      )}
    </div>
  );
}
