import { describe, expect, it, vi } from "vitest";
import { emitToast, subscribe } from "./bus";
import { DEFAULT_DURATION } from "./types";

describe("toast bus", () => {
  it("subscribe nhận toast với default kind/duration", () => {
    const fn = vi.fn();
    const off = subscribe(fn);
    emitToast({ message: "lỗi rồi" });
    off();

    expect(fn).toHaveBeenCalledTimes(1);
    const toast = fn.mock.calls[0][0];
    expect(toast.message).toBe("lỗi rồi");
    expect(toast.kind).toBe("error");
    expect(toast.duration).toBe(DEFAULT_DURATION);
    expect(typeof toast.id).toBe("string");
  });

  it("giữ nguyên kind/duration khi truyền vào", () => {
    const fn = vi.fn();
    const off = subscribe(fn);
    emitToast({ kind: "success", message: "ok", duration: 1000 });
    off();

    expect(fn.mock.calls[0][0]).toMatchObject({ kind: "success", duration: 1000 });
  });

  it("phát tới nhiều subscriber", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribe(a);
    const offB = subscribe(b);
    emitToast({ message: "x" });
    offA();
    offB();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe thì không nhận nữa", () => {
    const fn = vi.fn();
    const off = subscribe(fn);
    off();
    emitToast({ message: "x" });

    expect(fn).not.toHaveBeenCalled();
  });

  it("sinh id khác nhau cho mỗi toast", () => {
    const fn = vi.fn();
    const off = subscribe(fn);
    emitToast({ message: "1" });
    emitToast({ message: "2" });
    off();

    expect(fn.mock.calls[0][0].id).not.toBe(fn.mock.calls[1][0].id);
  });
});
