// Hook tiện dụng để bắn toast thủ công (vd báo "Đã lưu"). Vì bus đã global nên
// không cần Context bọc — emit thẳng qua bus. Nhận diện memo hoá để dùng trong effect.

import { useMemo } from "react";
import { emitToast } from "./bus";
import type { ToastKind } from "./types";

export function useToast() {
  return useMemo(
    () => ({
      toast: (message: string, kind?: ToastKind) => emitToast({ message, kind }),
      error: (message: string) => emitToast({ message, kind: "error" }),
      success: (message: string) => emitToast({ message, kind: "success" }),
      info: (message: string) => emitToast({ message, kind: "info" }),
    }),
    [],
  );
}
