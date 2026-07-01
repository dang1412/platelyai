import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./apiFetch";
import * as bus from "./toast/bus";

// Tạo Response giả với body JSON (hoặc không parse được).
function jsonRes(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiFetch", () => {
  it("res.ok → không bắn toast, trả Response", async () => {
    const emit = vi.spyOn(bus, "emitToast");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(200, { ok: true })));

    const res = await apiFetch("/api/x");

    expect(res.status).toBe(200);
    expect(emit).not.toHaveBeenCalled();
  });

  it("status 400 + {error} → bắn toast với đúng message, vẫn trả res", async () => {
    const emit = vi.spyOn(bus, "emitToast");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonRes(400, { error: "SDT không hợp lệ" })),
    );

    const res = await apiFetch("/api/x");

    expect(res.status).toBe(400);
    expect(emit).toHaveBeenCalledWith({ kind: "error", message: "SDT không hợp lệ" });
  });

  it("body caller vẫn đọc được sau khi apiFetch đọc lỗi (clone)", async () => {
    vi.spyOn(bus, "emitToast").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonRes(400, { error: "X", code: 42 })),
    );

    const res = await apiFetch("/api/x");
    const data = (await res.json()) as { code: number };

    expect(data.code).toBe(42);
  });

  it("status 500 body không JSON → bắn fallback message", async () => {
    const emit = vi.spyOn(bus, "emitToast");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(500, "<html>oops</html>")));

    await apiFetch("/api/x");

    expect(emit).toHaveBeenCalledWith({
      kind: "error",
      message: "Có lỗi xảy ra, thử lại sau.",
    });
  });

  it("opts.silent → fail nhưng không bắn toast", async () => {
    const emit = vi.spyOn(bus, "emitToast");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonRes(400, { error: "X" })),
    );

    await apiFetch("/api/x", undefined, { silent: true });

    expect(emit).not.toHaveBeenCalled();
  });

  it("network throw → bắn toast mạng và rethrow", async () => {
    const emit = vi.spyOn(bus, "emitToast");
    const netErr = new TypeError("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(netErr));

    await expect(apiFetch("/api/x")).rejects.toBe(netErr);
    expect(emit).toHaveBeenCalledWith({
      kind: "error",
      message: "Lỗi mạng, kiểm tra kết nối.",
    });
  });
});
