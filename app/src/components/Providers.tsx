"use client";

import { SessionProvider } from "next-auth/react";
import ToastProvider from "@/components/toast/ToastProvider";

// Bọc SessionProvider để các client component (vd AuthButton) dùng useSession().
// ToastProvider render viewport toast dùng chung toàn app.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
