import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { LatLng, ParsedQuery } from "./types";

// Ghi log mỗi lượt search ra file JSONL theo ngày (plan 16). Fire-and-forget: route gọi không
// await; lỗi ghi log nuốt trong appendSearchLog nên KHÔNG bao giờ làm vỡ luồng search.

// Một dòng log = một lượt search. error = message lỗi khi gọi LLM extract fail (null nếu không lỗi).
export type SearchLogEntry = {
  ts: string; // ISO timestamp lúc xử lý request
  userId: number | null; // null nếu khách (search là route công khai)
  q: string; // câu hỏi thô
  location: string | null; // địa điểm text trích từ câu (parsed.location)
  deviceCoords: LatLng | null; // toạ độ thiết bị client gửi (?lat=&lng=)
  origin: LatLng | null; // toạ độ gốc đã resolve (device thắng, không thì geocode)
  parsed: ParsedQuery | null; // kết quả extract
  resultCount: number; // số quán trả về
  error: string | null; // lỗi gọi LLM extract, null nếu không lỗi
};

// Thư mục ghi log; đổi qua env, default ./logs/search (theo cwd = app/).
function logDir(): string {
  return process.env.SEARCH_LOG_DIR ?? "./logs/search";
}

// THUẦN — tên file theo ngày local: YYYY-MM-DD.jsonl (zero-pad tháng/ngày).
export function logFileName(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}.jsonl`;
}

// THUẦN — một dòng JSONL (kèm newline cuối).
export function formatLogLine(entry: SearchLogEntry): string {
  return `${JSON.stringify(entry)}\n`;
}

// I/O — append một dòng vào file theo ngày. Nuốt mọi lỗi (chỉ console.error) để không làm vỡ search.
export async function appendSearchLog(entry: SearchLogEntry): Promise<void> {
  try {
    const dir = logDir();
    await fs.mkdir(dir, { recursive: true });
    const path = join(dir, logFileName(new Date(entry.ts)));
    await fs.appendFile(path, formatLogLine(entry));
  } catch (e) {
    console.error("appendSearchLog failed:", e);
  }
}
