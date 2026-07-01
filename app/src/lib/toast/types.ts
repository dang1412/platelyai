// Kiểu dữ liệu cho hệ thống toast notification (client-side, ephemeral).

export type ToastKind = "error" | "success" | "info";

// Toast đã chuẩn hoá — có id + duration để provider tự huỷ.
export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  duration: number;
};

// Input khi bắn toast — kind/duration optional (áp default trong bus).
export type ToastInput = {
  kind?: ToastKind;
  message: string;
  duration?: number;
};

// Thời gian tự huỷ mặc định (ms).
export const DEFAULT_DURATION = 4000;
// Kind mặc định — phần lớn toast là báo lỗi API fail.
export const DEFAULT_KIND: ToastKind = "error";
