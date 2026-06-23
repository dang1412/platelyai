"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";

// Trang chạy BÊN TRONG popup: vừa mở là đẩy popup sang Google OAuth.
// Sau callback, NextAuth quay về /auth/popup-done (trang tự đóng + báo trang cha).
export default function PopupStart() {
  useEffect(() => {
    signIn("google", { callbackUrl: "/auth/popup-done" });
  }, []);

  return (
    <main className="flex flex-1 items-center justify-center p-6 text-sm text-black/60">
      Đang chuyển tới Google…
    </main>
  );
}
