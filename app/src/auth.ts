import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { query } from "@/lib/db";

// Cấu hình Auth.js (NextAuth v5) — giai đoạn 1: chỉ đăng nhập Google.
//
// Session strategy = JWT (mặc định khi không gắn adapter): nhẹ, không cần bảng
// sessions. Hồ sơ user + role được lưu ở bảng `users` (xem db/init/02_auth.sql),
// upsert trong callback signIn. role được nhồi vào token rồi lộ ra session để
// phân quyền ở middleware / server component / API.

// Email được tự động cấp quyền admin lần đầu đăng nhập (bootstrap).
// Đặt trong .env: ADMIN_EMAILS=a@gmail.com,b@gmail.com
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

type Role = "admin" | "owner" | "user";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    // Upsert user theo email mỗi lần đăng nhập. Email trong ADMIN_EMAILS được
    // nâng lên admin; user đã tồn tại thì giữ nguyên role hiện có.
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const wantAdmin = ADMIN_EMAILS.has(email);
      await query(
        `INSERT INTO users (email, name, image, role, last_login_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           image = EXCLUDED.image,
           role = CASE WHEN $5 THEN 'admin' ELSE users.role END,
           last_login_at = now()`,
        [email, user.name ?? null, user.image ?? null, wantAdmin ? "admin" : "user", wantAdmin],
      );
      return true;
    },

    // Lần đăng nhập đầu (có `user`): nạp id + role từ DB vào token.
    // Các lần sau: làm tươi role từ DB theo uid — role đổi khi gán/gỡ chủ quán, nếu không
    // refetch thì JWT giữ role cũ (vd owner đã bị gỡ vẫn thấy phần Quản trị tới lần đăng nhập sau).
    async jwt({ token, user }) {
      if (user?.email) {
        const rows = await query<{ id: string; role: Role }>(
          `SELECT id::text, role FROM users WHERE email = $1`,
          [user.email.toLowerCase()],
        );
        if (rows[0]) {
          token.uid = rows[0].id;
          token.role = rows[0].role;
        }
      } else if (token.uid) {
        const rows = await query<{ role: Role }>(
          `SELECT role FROM users WHERE id = $1`,
          [token.uid],
        );
        if (rows[0]) token.role = rows[0].role;
      }
      return token;
    },

    // Lộ id + role ra session để dùng phía app.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? "";
        session.user.role = (token.role as Role) ?? "user";
      }
      return session;
    },
  },
});
