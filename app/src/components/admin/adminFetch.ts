// Helper gọi API admin từ client: gửi JSON (hoặc FormData khi upload file), ném Error(message)
// khi !ok để form hiển thị. FormData → để browser tự set Content-Type kèm boundary.
export async function adminFetch(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<unknown> {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body == null ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Có lỗi xảy ra");
  }
  return res.json().catch(() => ({}));
}
