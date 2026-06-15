import { query } from "./db";

// Vocab tag vibe (bảng tags) cho bước extract (yếu tố 3) — nhồi vào prompt + validate output.
// Cache trong vòng đời process; lỗi DB → trả [] và KHÔNG cache (thử lại lần sau).

let cache: string[] | null = null;

export async function loadTagVocab(): Promise<string[]> {
  if (cache) return cache;
  try {
    const rows = await query<{ name: string }>(
      `SELECT name FROM tags WHERE name IS NOT NULL ORDER BY name`,
    );
    cache = rows.map((r) => r.name);
    return cache;
  } catch (e) {
    console.error("loadTagVocab failed:", e);
    return [];
  }
}

// Test-only: xoá cache giữa các test.
export function _resetTagVocabCache(): void {
  cache = null;
}
