import type { DefaultSession } from "next-auth";

// Mở rộng kiểu Session: thêm id + role vào session.user (nhồi ở callback session).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "owner" | "user";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "admin" | "owner" | "user";
  }
}
