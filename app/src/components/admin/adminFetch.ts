// Helper gọi API admin từ client: gửi JSON, ném Error(message) khi !ok để form hiển thị.
export async function adminFetch(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Có lỗi xảy ra");
  }
  return res.json().catch(() => ({}));
}
