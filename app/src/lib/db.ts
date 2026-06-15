import { Pool, type QueryResultRow } from "pg";

// Kết nối Postgres dùng chung — pg thuần (đã bỏ drizzle, xem plan 01 §4). SQL viết tay,
// tham số hoá qua $1,$2... để tránh injection.

// Tái dùng pool qua các lần hot-reload của Next.js (dev) để không tạo quá nhiều kết nối.
const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

// Helper query gọn: trả thẳng rows đã ép kiểu. params mặc định rỗng cho query tĩnh.
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params as never[]);
  return res.rows;
}
