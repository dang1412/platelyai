import { describe, it, expect } from "vitest";
import { groupSellerOrders, nextSellerStep, canReject } from "./sellerActions";
import type { Fulfillment, Order, OrderStatus } from "./types";

function order(
  id: string,
  status: OrderStatus,
  createdAt: string,
  fulfillment: Fulfillment = "delivery",
): Order {
  return {
    id,
    restaurantId: "1",
    restaurantName: "Quán test",
    fulfillment,
    status,
    items: [],
    total: 0,
    phone: "0900000000",
    address: fulfillment === "delivery" ? "đâu đó" : null,
    note: null,
    events: [],
    createdAt,
  };
}

describe("groupSellerOrders", () => {
  it("chia 3 cụm needsAction/inProgress/done, mỗi cụm mới nhất trước", () => {
    const input = [
      order("p1", "pending", "2026-06-01T00:00:00.000Z"),
      order("i1", "delivering", "2026-06-02T00:00:00.000Z"),
      order("d1", "completed", "2026-06-03T00:00:00.000Z"),
      order("p2", "pending", "2026-06-04T00:00:00.000Z"),
      order("i2", "accepted", "2026-06-05T00:00:00.000Z"),
      order("d2", "rejected", "2026-06-06T00:00:00.000Z"),
    ];
    const { needsAction, inProgress, done } = groupSellerOrders(input);
    expect(needsAction.map((o) => o.id)).toEqual(["p2", "p1"]);
    expect(inProgress.map((o) => o.id)).toEqual(["i2", "i1"]);
    expect(done.map((o) => o.id)).toEqual(["d2", "d1"]);
  });

  it("mảng rỗng → 3 cụm rỗng, không mutate input", () => {
    expect(groupSellerOrders([])).toEqual({
      needsAction: [],
      inProgress: [],
      done: [],
    });
    const input = [
      order("a", "pending", "2026-06-01T00:00:00.000Z"),
      order("b", "accepted", "2026-06-02T00:00:00.000Z"),
    ];
    const snapshot = input.map((o) => o.id);
    groupSellerOrders(input);
    expect(input.map((o) => o.id)).toEqual(snapshot);
  });
});

describe("nextSellerStep", () => {
  it("delivery: chuỗi bước đúng nhãn", () => {
    expect(nextSellerStep(order("1", "pending", "t"))).toMatchObject({
      toStatus: "accepted",
      label: "Nhận đơn",
    });
    expect(nextSellerStep(order("1", "accepted", "t"))).toMatchObject({
      toStatus: "delivering",
      label: "Bắt đầu giao",
    });
    expect(nextSellerStep(order("1", "delivering", "t"))).toMatchObject({
      toStatus: "arrived",
      label: "Đã tới nơi",
    });
    expect(nextSellerStep(order("1", "arrived", "t"))).toMatchObject({
      toStatus: "completed",
      label: "Hoàn tất",
    });
  });

  it("pickup: accepted → ready → completed", () => {
    expect(nextSellerStep(order("1", "accepted", "t", "pickup"))).toMatchObject({
      toStatus: "ready",
      label: "Sẵn sàng lấy",
    });
    expect(nextSellerStep(order("1", "ready", "t", "pickup"))).toMatchObject({
      toStatus: "completed",
      label: "Hoàn tất",
    });
  });

  it("trạng thái kết thúc → null", () => {
    for (const s of ["completed", "rejected", "cancelled"] as const) {
      expect(nextSellerStep(order("1", s, "t"))).toBeNull();
    }
  });
});

describe("canReject", () => {
  it("true chỉ khi pending", () => {
    expect(canReject(order("1", "pending", "t"))).toBe(true);
    for (const s of [
      "accepted",
      "delivering",
      "arrived",
      "ready",
      "completed",
      "rejected",
      "cancelled",
    ] as const) {
      expect(canReject(order("1", s, "t"))).toBe(false);
    }
  });
});
