/**
 * Dự án đang ở màn đọc file SRS (chưa vào workspace soạn / sửa) — nhớ để lần mở trang kế tiếp hiện **ngay** skeleton của màn đọc
 * file, không chớp skeleton workspace (rail + chat) rồi mới đổi. Lưu bằng cookie (không phải localStorage) để server đọc được
 * (`app/projects/[id]/layout.tsx`) ⇒ HTML đầu tiên và lần hydrate đã là đúng skeleton. Chỉ là gợi ý bố cục; trạng thái thật do BE trả.
 */
export const importPendingCookie = (projectId: string) => `ff-import-pending-${projectId}`;

const MAX_AGE_S = 60 * 60 * 24 * 30;

export const markImportPending = (projectId: string): void => {
  if (typeof document === "undefined" || !projectId) return;
  document.cookie = `${importPendingCookie(projectId)}=1; path=/; max-age=${MAX_AGE_S}; samesite=lax`;
};

export const clearImportPending = (projectId: string): void => {
  if (typeof document === "undefined" || !projectId) return;
  document.cookie = `${importPendingCookie(projectId)}=; path=/; max-age=0; samesite=lax`;
};

export const isImportPending = (projectId: string): boolean => {
  if (typeof document === "undefined" || !projectId) return false;
  return document.cookie.split("; ").includes(`${importPendingCookie(projectId)}=1`);
};
