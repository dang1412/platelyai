// Phân quyền đơn hàng — tái dùng canEdit (quyền sở hữu quán) ở src/lib/authz.ts.
// View: buyer của đơn / seller của quán / admin. Act: transition hợp lệ + đúng actor.

import { canEdit, AuthzError, type CurrentUser } from "@/lib/authz";
import { ValidationError } from "@/lib/adminValidate";
import { canTransition, allowedActors } from "./state";
import type { OrderStatus } from "./types";
import type { OrderAuth } from "./repo";

export function isSellerOf(user: CurrentUser, restaurantId: number): Promise<boolean> {
  return canEdit(user, restaurantId);
}

export async function canViewOrder(
  user: CurrentUser,
  order: OrderAuth,
): Promise<boolean> {
  if (user.id === order.buyerId) return true;
  return canEdit(user, order.restaurantId); // seller của quán / admin
}

// Chặn nếu transition không hợp lệ (400) hoặc user không phải actor được phép (403).
export async function assertCanAct(
  user: CurrentUser,
  order: OrderAuth,
  toStatus: OrderStatus,
): Promise<void> {
  if (!canTransition(order.fulfillment, order.status, toStatus)) {
    throw new ValidationError("Chuyển trạng thái không hợp lệ");
  }
  const actors = allowedActors(toStatus);
  const isBuyer = user.id === order.buyerId;
  const isSeller = await canEdit(user, order.restaurantId);
  const ok = (actors.has("buyer") && isBuyer) || (actors.has("seller") && isSeller);
  if (!ok) throw new AuthzError(403, "Không có quyền đổi trạng thái đơn này");
}
