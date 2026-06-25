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

// Cùng chữ ký với query() nhưng bám trên một client cụ thể (dùng trong withTransaction).
export type TxQuery = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

// Chạy fn trong một transaction: BEGIN → fn(q) → COMMIT; lỗi → ROLLBACK rồi rethrow.
// q là query bám trên client đã BEGIN nên nhiều câu cùng nguyên tử. Vẫn tham số hoá $1,$2…
export async function withTransaction<T>(
  fn: (q: TxQuery) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  const q: TxQuery = async (text, params = []) => {
    const res = await client.query(text, params as never[]);
    return res.rows as never;
  };
  try {
    await client.query("BEGIN");
    const result = await fn(q);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
