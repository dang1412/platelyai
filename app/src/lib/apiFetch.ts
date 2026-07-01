// Wrapper fetch dùng chung: request fail → tự đọc `{ error }` từ server và bắn toast
// lỗi. Vẫn trả về `Response` để caller xử lý tiếp (rollback optimistic, đọc field khác).
// Module thuần — không "use client", chạy được cả client lẫn server.

import { emitToast } from "./toast/bus";

type ApiFetchOpts = {
  // Tắt auto-toast khi caller tự hiển thị lỗi (tránh double-report).
  silent?: boolean;
  // Message mặc định khi server không trả `{ error }`.
  fallbackMessage?: string;
};

const DEFAULT_FALLBACK = "Có lỗi xảy ra, thử lại sau.";
const NETWORK_MESSAGE = "Lỗi mạng, kiểm tra kết nối.";

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts: ApiFetchOpts = {},
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    // Lỗi mạng (không tới được server) — báo rồi rethrow để catch/finally cũ vẫn chạy.
    if (!opts.silent) emitToast({ kind: "error", message: NETWORK_MESSAGE });
    throw err;
  }

  if (!res.ok && !opts.silent) {
    const data = (await res
      .clone()
      .json()
      .catch(() => null)) as { error?: string } | null;
    const message = data?.error ?? opts.fallbackMessage ?? DEFAULT_FALLBACK;
    emitToast({ kind: "error", message });
  }

  return res;
}
