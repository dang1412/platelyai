import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Nạp .env vào process.env cho test (vitest không tự load như Next.js). Chỉ set key chưa có,
// để integration test chạm Postgres thật (AGENTS §6) lấy được DATABASE_URL. Thiếu .env → bỏ qua.
try {
  const envPath = fileURLToPath(new URL("./.env", import.meta.url));
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
} catch {
  // không có .env (ví dụ CI) → test chạm DB sẽ tự skip.
}
