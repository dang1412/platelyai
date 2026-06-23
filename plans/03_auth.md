# Plan 03 — Auth: đăng nhập Google (giai đoạn 1)

> Nền tảng tài khoản + phân quyền cho lộ trình: **admin** (quản trị) → **chủ quán** (owner, nhận đặt
> món) → **user** (khách đặt món). File liên quan: `app/src/auth.ts`, `db/init/02_auth.sql`,
> `app/src/app/api/auth/[...nextauth]/route.ts`, `app/src/app/{login,admin}/`,
> `app/src/components/{AuthButton,Providers}.tsx`.

## Quyết định kiến trúc

**Thư viện: Auth.js (NextAuth v5, `next-auth@5.0.0-beta.31`)** — cài bằng **pnpm** (repo dùng
`pnpm-lock.yaml`; npm crash vì arborist không đọc được layout pnpm).

**Tách auth theo vai trò, không một-cỡ-cho-tất-cả:**

| Vai trò | Cách đăng nhập | Lý do |
|---|---|---|
| admin (bạn) | Google | miễn phí, nhanh, kiểm soát qua email |
| owner (chủ quán) | Google | chủ quán thường có Gmail; duyệt quyền tay |
| user (đặt món) | **SĐT OTP** — giai đoạn sau | khách VN quen nhập SĐT; OTP tốn phí SMS nên chưa làm vội. Cân nhắc thêm Zalo login |

→ **Giai đoạn 1 (đã làm): chỉ Google login** cho admin/owner. SĐT OTP để giai đoạn sau khi mở
đặt món thật (nối SMS provider VN: ESMS/SpeedSMS/FPT/Stringee — tránh Twilio vì đắt + hay chặn số VN).

**Session = JWT (không adapter):** không cần bảng `accounts`/`sessions`. Hồ sơ + role tự quản ở bảng
`users`, upsert mỗi lần đăng nhập. Gọn, khớp setup `pg` thuần tự host (xem [plan 01](./01_search_api.md)).

**Guard `/admin` = server component** (`admin/layout.tsx` gọi `auth()`), KHÔNG dùng middleware: `pg`
là Node-only, chạy trên edge runtime của middleware sẽ vỡ. Server component chạy Node nên dùng `pg` được.

## Mô hình dữ liệu

`db/init/02_auth.sql` — bảng `users`:
- `email` (unique), `name`, `image`, `created_at`, `last_login_at`
- `role TEXT CHECK (role IN ('admin','owner','user')) DEFAULT 'user'`

DB chạy **trực tiếp trên host** (Postgres local port 5432, KHÔNG qua container — `docker compose up`
fail vì 5432 đã bận). Migrate volume đã có dữ liệu bằng:
```
set -a; . ./.env; set +a
psql "$DATABASE_URL" -f db/init/02_auth.sql
```
(File `02_auth.sql` cũng tự chạy khi volume Postgres còn trống, qua `/docker-entrypoint-initdb.d`.)

## Luồng cấp quyền

- `signIn` callback: upsert `users` theo email. Email có trong env `ADMIN_EMAILS` (phân tách dấu phẩy)
  được nâng lên `admin` lần đầu đăng nhập; user đã tồn tại giữ nguyên role.
- `jwt` callback: nạp `id` + `role` từ DB vào token.
- `session` callback: lộ `session.user.id` + `session.user.role` (type mở rộng ở
  `app/src/types/next-auth.d.ts`).
- Nâng quyền owner: `UPDATE users SET role='owner' WHERE email=...` (tay, giai đoạn 1).

## UI

- `login/page.tsx`: nút "Tiếp tục với Google" (server action `signIn`). Đã login → redirect `/admin`.
- `admin/`: layout guard + dashboard placeholder (sẽ thành quản lý quán / nhận đặt món ở giai đoạn sau).
- Header trang chủ (`page.tsx`): `<AuthButton/>` góc trên phải — chưa login = nút "Đăng nhập";
  đã login = avatar + menu (email, "Trang quản trị" nếu admin, "Đăng xuất"). Cần `SessionProvider`
  (`components/Providers.tsx`) bọc ở `layout.tsx`.
- **Login dạng popup (không chuyển trang):** OAuth của NextAuth mặc định redirect cả trang. Để mở
  popup, `AuthButton` mở `window.open('/auth/popup-start')` → trang đó chạy `signIn('google',
  {callbackUrl:'/auth/popup-done'})` trong popup → `/auth/popup-done` `postMessage` về trang cha rồi
  `window.close()` → cha nghe message và gọi `useSession().update()` refetch (không reload). Popup bị
  chặn thì fallback `signIn('google')` redirect. Server action `signIn` ở `/login` vẫn giữ làm fallback
  khi vào thẳng `/admin` lúc chưa login.
- `next.config.ts`: cho phép `lh3.googleusercontent.com` (avatar Google) trong `images.remotePatterns`.

## Env cần có (`.env` ở root, app symlink `app/.env`)

```
AUTH_SECRET=...            # đã gen bằng openssl rand -base64 33
AUTH_GOOGLE_ID=...         # Google Cloud Console → OAuth client (Web)
AUTH_GOOGLE_SECRET=...
ADMIN_EMAILS=dttung1412@gmail.com
```
Google OAuth redirect URI (dev): `http://localhost:3000/api/auth/callback/google`.

## Việc còn lại / giai đoạn sau

- [ ] Điền `AUTH_GOOGLE_ID/SECRET` thật rồi test login → role admin.
- [ ] Giai đoạn 2: role `owner` cho chủ quán + UI quản lý quán & nhận đặt món.
- [ ] Giai đoạn 2: SĐT OTP (+ cân nhắc Zalo) cho khách đặt món; nối SMS provider VN.
- [ ] Khi deploy: thêm redirect URI production + `AUTH_URL`/trusted host.
