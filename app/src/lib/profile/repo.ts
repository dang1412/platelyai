// Lớp dữ liệu thông tin mặc định của buyer (mọi SQL tham số hoá $1,$2…, §3).
// 1 buyer = 1 dòng `users` → đọc/ghi thẳng các cột default_* (xem db/init/12_buyer_profile.sql).

import { query } from "@/lib/db";
import type { BuyerProfileInput } from "@/lib/profileValidate";

export type BuyerProfile = {
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

type ProfileRow = {
  default_phone: string | null;
  default_address: string | null;
  default_lat: number | string | null;
  default_lng: number | string | null;
};

const toNum = (v: number | string | null): number | null =>
  v == null ? null : Number(v);

export async function getBuyerProfile(userId: number): Promise<BuyerProfile> {
  const [row] = await query<ProfileRow>(
    `SELECT default_phone, default_address, default_lat, default_lng
       FROM users WHERE id = $1`,
    [userId],
  );
  if (!row) return { phone: null, address: null, lat: null, lng: null };
  return {
    phone: row.default_phone,
    address: row.default_address,
    lat: toNum(row.default_lat),
    lng: toNum(row.default_lng),
  };
}

// Row user chắc chắn tồn tại (đã đăng nhập) → UPDATE thẳng.
export async function upsertBuyerProfile(
  userId: number,
  input: BuyerProfileInput,
): Promise<void> {
  await query(
    `UPDATE users
        SET default_phone = $2, default_address = $3, default_lat = $4, default_lng = $5
      WHERE id = $1`,
    [userId, input.phone, input.address, input.lat, input.lng],
  );
}
