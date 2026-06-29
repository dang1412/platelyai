import { describe, it, expect } from "vitest";
import {
  timelineSteps,
  statusTone,
  flowFor,
  isActiveStatus,
  groupOrders,
} from "./statusMeta";
import type { Order, OrderStatus } from "./types";

// Tạo đơn tối thiểu cho test phân nhóm — chỉ cần status + createdAt.
function order(id: string, status: OrderStatus, createdAt: string): Order {
  return {
    id,
    restaurantName: "Quán test",
    fulfillment: "delivery",
    status,
    items: [],
    total: 0,
    phone: "0900000000",
    address: null,
    note: null,
    events: [],
    createdAt,
  };
}

describe("flowFor", () => {
  it("delivery có bước 'delivering' + 'arrived'; pickup có 'ready' thay thế", () => {
    expect(flowFor("delivery")).toEqual([
      "pending",
      "accepted",
      "delivering",
      "arrived",
      "completed",
    ]);
    expect(flowFor("pickup")).toEqual([
      "pending",
      "accepted",
      "ready",
      "completed",
    ]);
  });
});

describe("timelineSteps", () => {
  it("đánh dấu done/current/todo theo vị trí status (delivery)", () => {
    const steps = timelineSteps("delivery", "delivering");
    expect(steps.map((s) => s.state)).toEqual([
      "done", // pending
      "done", // accepted
      "current", // delivering
      "todo", // arrived
      "todo", // completed
    ]);
    expect(steps).toHaveLength(5);
  });

  it("pickup KHÔNG có bước delivering/arrived; 'ready' là current", () => {
    const steps = timelineSteps("pickup", "ready");
    expect(steps.map((s) => s.key)).toEqual([
      "pending",
      "accepted",
      "ready",
      "completed",
    ]);
    expect(steps.find((s) => s.key === "ready")?.state).toBe("current");
    expect(steps.some((s) => s.key === "delivering")).toBe(false);
  });

  it("pending → mọi bước sau là todo, bước đầu là current", () => {
    const steps = timelineSteps("delivery", "pending");
    expect(steps[0].state).toBe("current");
    expect(steps.slice(1).every((s) => s.state === "todo")).toBe(true);
  });

  it("completed → tất cả done trừ bước cuối là current", () => {
    const steps = timelineSteps("pickup", "completed");
    expect(steps.at(-1)?.state).toBe("current");
    expect(steps.slice(0, -1).every((s) => s.state === "done")).toBe(true);
  });

  it("cancelled/rejected → dừng ở nhánh kết thúc (pending done + trạng thái kết thúc current)", () => {
    for (const s of ["cancelled", "rejected"] as const) {
      const steps = timelineSteps("delivery", s);
      expect(steps).toHaveLength(2);
      expect(steps[0]).toMatchObject({ key: "pending", state: "done" });
      expect(steps[1]).toMatchObject({ key: s, state: "current" });
    }
  });
});

describe("statusTone", () => {
  it("phân nhóm màu: active / success / muted", () => {
    expect(statusTone("pending")).toBe("active");
    expect(statusTone("delivering")).toBe("active");
    expect(statusTone("completed")).toBe("success");
    expect(statusTone("cancelled")).toBe("muted");
    expect(statusTone("rejected")).toBe("muted");
  });
});

describe("isActiveStatus", () => {
  it("true cho trạng thái đang chạy, false cho trạng thái kết thúc", () => {
    const active: OrderStatus[] = [
      "pending",
      "accepted",
      "delivering",
      "arrived",
      "ready",
    ];
    const terminal: OrderStatus[] = ["completed", "rejected", "cancelled"];
    for (const s of active) expect(isActiveStatus(s)).toBe(true);
    for (const s of terminal) expect(isActiveStatus(s)).toBe(false);
  });
});

describe("groupOrders", () => {
  it("chia đúng nhóm active/history, mỗi nhóm mới nhất trước", () => {
    const input = [
      order("a1", "pending", "2026-06-01T00:00:00.000Z"),
      order("h1", "completed", "2026-06-02T00:00:00.000Z"),
      order("a2", "delivering", "2026-06-03T00:00:00.000Z"),
      order("h2", "cancelled", "2026-06-04T00:00:00.000Z"),
    ];
    const { active, history } = groupOrders(input);
    expect(active.map((o) => o.id)).toEqual(["a2", "a1"]); // desc theo createdAt
    expect(history.map((o) => o.id)).toEqual(["h2", "h1"]);
  });

  it("mảng rỗng → hai nhóm rỗng", () => {
    expect(groupOrders([])).toEqual({ active: [], history: [] });
  });

  it("không mutate mảng đầu vào", () => {
    const input = [
      order("a1", "pending", "2026-06-01T00:00:00.000Z"),
      order("a2", "accepted", "2026-06-03T00:00:00.000Z"),
    ];
    const snapshot = input.map((o) => o.id);
    groupOrders(input);
    expect(input.map((o) => o.id)).toEqual(snapshot);
  });
});
