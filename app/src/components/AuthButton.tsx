"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";

// Nút đăng nhập / avatar cho header. Dùng useSession (cần SessionProvider ở layout).
export default function AuthButton() {
  const { data: session, status, update } = useSession();
  const [open, setOpen] = useState(false);

  // Đăng nhập qua popup: KHÔNG chuyển trang. Popup chạy OAuth rồi postMessage về
  // (xem /auth/popup-start + /auth/popup-done); nhận được thì update() refetch session.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data === "plately-auth-success") {
        update();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [update]);

  const loginPopup = useCallback(() => {
    const w = 480;
    const h = 640;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 3;
    const popup = window.open(
      "/auth/popup-start",
      "plately-login",
      `width=${w},height=${h},left=${left},top=${top}`,
    );
    // Popup bị trình duyệt chặn -> fallback về luồng redirect cả trang.
    if (!popup) signIn("google");
  }, []);

  if (status === "loading") {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />;
  }

  if (!session?.user) {
    return (
      <button
        type="button"
        onClick={loginPopup}
        aria-label="Đăng nhập"
        title="Đăng nhập"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 transition hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
      >
        {/* icon user/đăng nhập cho gọn (mobile) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
        </svg>
      </button>
    );
  }

  const user = session.user;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-zinc-200 p-1 transition hover:bg-zinc-100 sm:pr-3 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
        {/* Mobile: chỉ hiện avatar để khỏi đè lên logo ở header; tên hiện từ sm trở lên. */}
        <span className="hidden max-w-[8rem] truncate text-sm sm:inline">
          {user.name ?? user.email}
        </span>
      </button>

      {/* Side menu trượt từ phải. Luôn mount để có hiệu ứng trượt; ẩn bằng translate. */}
      <button
        type="button"
        aria-label="Đóng menu"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 cursor-default bg-black/40 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-72 max-w-[80vw] flex-col border-l border-zinc-200 bg-white text-sm shadow-xl transition-transform dark:border-zinc-700 dark:bg-zinc-900 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header: thông tin user + nút đóng */}
        <div className="flex items-start gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name ?? "avatar"}
              width={40}
              height={40}
              className="rounded-full"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-300 text-sm font-medium dark:bg-zinc-600">
              {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{user.name ?? user.email}</div>
            <div className="truncate text-zinc-500 dark:text-zinc-400">{user.email}</div>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={() => setOpen(false)}
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col py-2">
          {user.role === "admin" && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="px-4 py-3 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Trang quản trị
            </Link>
          )}
        </nav>

        {/* Đăng xuất ghim đáy */}
        <button
          type="button"
          onClick={() => signOut()}
          className="border-t border-zinc-100 px-4 py-3 text-left text-red-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800"
        >
          Đăng xuất
        </button>
      </aside>
    </div>
  );
}
