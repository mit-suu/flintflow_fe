/**
 * Hằng bố cục của workspace dùng chung cho trang thật (`page.tsx`) và khung đang tải (`WorkspaceLoading`): bề rộng kéo được
 * của từng khung (nhớ trong localStorage), rail tiến độ mở hay ẩn, kiểu nút hành động của dự án nhập SRS. Hai nơi đọc cùng
 * một nguồn ⇒ khung đang tải đúng bề ngang trang sắp hiện.
 */

// Bề rộng kéo được (px): khung chat, rail tiến độ trái, panel phải, cột Brief — mỗi khung nhớ riêng trong localStorage
export const CHAT_WIDTH_KEY = "flintflow_chat_pane_width";
export const RAIL_WIDTH_KEY = "flintflow_progress_rail_width";
export const PANEL_WIDTH_KEY = "flintflow_right_panel_width";
export const BRIEF_WIDTH_KEY = "flintflow_brief_panel_width";

export const CHAT_DEFAULT_WIDTH = 480;
export const RAIL_DEFAULT_WIDTH = 264;
export const PANEL_DEFAULT_WIDTH = 360;
export const BRIEF_DEFAULT_WIDTH = 400;

export const CHAT_MIN = 320;
export const RAIL_MIN = 200;
export const PANEL_MIN = 300;
export const BRIEF_MIN = 320;

export const PROGRESS_OPEN_KEY = "flintflow_workspace_progress_open";

/** Bề rộng đã lưu của một khung (không đọc được / nhỏ hơn tối thiểu ⇒ mặc định). */
export const readSavedWidth = (key: string, fallback: number, min: number): number => {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = parseInt(localStorage.getItem(key) ?? "", 10);
    if (!isNaN(parsed) && parsed >= min) return parsed;
  } catch {}
  return fallback;
};

/** Mặc định mở: lần đầu vào workspace phải thấy ngay mình đang ở bước nào, rail ẩn chỉ khi user tự đóng. */
export const readSavedProgressOpen = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(PROGRESS_OPEN_KEY) !== "0";
  } catch {
    return true;
  }
};

/** Nút hành động trên header của dự án nhập SRS (Gap report, Change request…). */
export const MODE1_ACTION =
  "shrink-0 px-3 py-1.5 rounded-full border border-[#DCD8F0] bg-[#F2F1FB] text-body font-bold text-[#554DB0] hover:bg-[#E8E6F7] transition-colors";
