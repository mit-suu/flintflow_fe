/**
 * File người dùng vừa đính kèm trong chat và chọn "Cập nhật phiên bản mới" (business-flow §3.6) — chuyển sang báo cáo khác biệt
 * (`panel=reupload`) mà không bắt chọn lại file. `File` không đi qua URL được nên giữ trong bộ nhớ của tab; tải lại trang thì mất
 * (người dùng đính kèm lại là gợi ý hiện lại).
 */
let pending: File | null = null;

export const setPendingReupload = (file: File): void => {
  pending = file;
};

/** Lấy một lần: đọc xong thì xoá, mở lại panel sau đó không tự tải lại file cũ. */
export const takePendingReupload = (): File | null => {
  const file = pending;
  pending = null;
  return file;
};
