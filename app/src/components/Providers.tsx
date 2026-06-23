"use client";

import { SessionProvider } from "next-auth/react";

// Bọc SessionProvider để các client component (vd AuthButton) dùng useSession().
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
