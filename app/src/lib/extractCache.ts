import type { ParsedQuery } from "./types";

// Cache in-memory cho kết quả extract (plan 08). extractQuery chỉ phụ thuộc q + vocab (KHÔNG
// origin) → cùng câu hỏi tái dùng kết quả, tránh gọi lại Gemini: ca bật/tắt vị trí re-fetch cùng q,
// và lỗi "high demand" (503/429) do gọi trùng lặp + nhiều người search cùng lúc.
//
// Per-process (multi-instance → mỗi instance cache riêng; nâng Redis sau). Chỉ cache kết quả THÀNH
// CÔNG: compute trả null khi fail → KHÔNG cache, để 503 thoáng qua được thử lại. Đồng nhất triết lý
// tags.ts ("lỗi → KHÔNG cache").

export const CACHE_MAX = 1000;
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h (tunable; restart cũng xoá sạch)

type Entry = { value: ParsedQuery; exp: number };

// Map giữ thứ tự chèn → dùng làm LRU: key đầu = cũ nhất; đọc hit thì xoá+set lại để đẩy về cuối.
const cache = new Map<string, Entry>();
// Single-flight: call đang bay theo key, để N request trùng gộp về một lần gọi Gemini.
const inflight = new Map<string, Promise<ParsedQuery | null>>();

// djb2 — hash gọn, ổn định theo nội dung cho chữ ký vocab (không cần crypto).
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

// Key = câu hỏi chuẩn hoá + chữ ký vocab. vocab nhúng vào systemInstruction nên đổi vocab (admin
// thêm/sửa tag) → extraction có thể khác → phải vào key. Sort vocab để thứ tự không ảnh hưởng.
export function buildKey(q: string, vocab: string[]): string {
  const normQ = q.toLowerCase().trim().replace(/\s+/g, " ");
  const sig = `${vocab.length}:${hash([...vocab].sort().join("|"))}`;
  return `${normQ}::${sig}`;
}

// Hit còn hạn → trả ngay (bump recency). Đang có call cùng key bay → await chính nó (single-flight).
// Else chạy compute; compute trả null (fallback/lỗi) → KHÔNG cache.
export async function getOrCompute(
  key: string,
  compute: () => Promise<ParsedQuery | null>,
): Promise<ParsedQuery | null> {
  const hit = cache.get(key);
  if (hit) {
    if (hit.exp > Date.now()) {
      cache.delete(key);
      cache.set(key, hit); // LRU: đẩy về cuối
      return hit.value;
    }
    cache.delete(key); // hết hạn → coi như miss
  }

  const flying = inflight.get(key);
  if (flying) return flying;

  // Tạo promise + đăng ký inflight ĐỒNG BỘ (không await xen giữa) → 2 request trùng tới cùng lúc
  // thì request sau thấy inflight ngay, không tạo call thứ hai.
  const p = (async () => {
    const value = await compute();
    if (value != null) store(key, value);
    return value;
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

function store(key: string, value: ParsedQuery): void {
  cache.set(key, { value, exp: Date.now() + CACHE_TTL_MS });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value; // key đầu = cũ nhất
    if (oldest !== undefined) cache.delete(oldest);
  }
}

// Test-only: xoá cache + in-flight giữa các test (mirror tags.ts:_resetTagVocabCache).
export function _resetExtractCache(): void {
  cache.clear();
  inflight.clear();
}
