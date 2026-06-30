import { describe, it, expect } from "vitest";
import { canTransition, nextStatusesFor, allowedActors } from "./state";
import type { OrderStatus } from "./types";

describe("nextStatusesFor / canTransition", () => {
  it("pending → accepted | rejected | cancelled (cả hai fulfillment)", () => {
    for (const f of ["delivery", "pickup"] as const) {
      expect(new Set(nextStatusesFor(f, "pending"))).toEqual(
        new Set<OrderStatus>(["accepted", "rejected", "cancelled"]),
      );
    }
  });

  it("accepted phân nhánh: delivery→delivering, pickup→ready (+cancelled)", () => {
    expect(new Set(nextStatusesFor("delivery", "accepted"))).toEqual(
      new Set<OrderStatus>(["delivering", "cancelled"]),
    );
    expect(new Set(nextStatusesFor("pickup", "accepted"))).toEqual(
      new Set<OrderStatus>(["ready", "cancelled"]),
    );
  });

  it("pickup KHÔNG cho accepted→delivering; delivery KHÔNG cho accepted→ready", () => {
    expect(canTransition("pickup", "accepted", "delivering")).toBe(false);
    expect(canTransition("delivery", "accepted", "ready")).toBe(false);
  });

  it("chuỗi delivery: delivering→arrived→completed", () => {
    expect(canTransition("delivery", "delivering", "arrived")).toBe(true);
    expect(canTransition("delivery", "arrived", "completed")).toBe(true);
  });

  it("chuỗi pickup: ready→completed", () => {
    expect(canTransition("pickup", "ready", "completed")).toBe(true);
  });

  it("terminal không đi tiếp; bước nhảy cóc bị chặn", () => {
    for (const s of ["completed", "rejected", "cancelled"] as const) {
      expect(nextStatusesFor("delivery", s)).toEqual([]);
    }
    expect(canTransition("delivery", "pending", "completed")).toBe(false);
    expect(canTransition("delivery", "accepted", "arrived")).toBe(false);
  });
});

describe("allowedActors", () => {
  it("seller cho accepted/rejected/delivering/arrived/ready", () => {
    for (const s of ["accepted", "rejected", "delivering", "arrived", "ready"] as const) {
      expect(allowedActors(s)).toEqual(new Set(["seller"]));
    }
  });

  it("buyer cho cancelled; completed cho cả hai", () => {
    expect(allowedActors("cancelled")).toEqual(new Set(["buyer"]));
    expect(allowedActors("completed")).toEqual(new Set(["buyer", "seller"]));
  });
});
