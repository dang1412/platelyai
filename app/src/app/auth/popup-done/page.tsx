"use client";

import { useEffect } from "react";

// Đích sau khi đăng nhập xong (chạy trong popup). Báo cho trang cha rồi tự đóng.
// Nếu vì lý do gì mở trực tiếp (không phải popup) thì quay về trang chủ.
export default function PopupDone() {
  useEffect(() => {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage("plately-auth-success", window.location.origin);
      window.close();
    } else {
      window.location.replace("/");
    }
  }, []);

  return (
    <main className="flex flex-1 items-center justify-center p-6 text-sm text-black/60">
      Đăng nhập thành công, đang đóng…
    </main>
  );
}
