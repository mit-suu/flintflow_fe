import type { ReviewMode } from "@/types/spine";
import { clearBrowserCookie, parseJsonCookie, readBrowserCookie, writeBrowserCookie } from "./browser-cookie";

/**
 * Bản nhớ bố cục của dự án mở gần nhất: loại dự án, tên, giai đoạn đang làm, khung phải đang hiện. Workspace chỉ biết những
 * thứ này sau khi tải dự án + tiến độ; có bản nhớ thì khung đang tải (`WorkspaceLoading`) dựng ĐÚNG bố cục sắp hiện ngay từ
 * HTML server: rail hay không, nút header của loại dự án, nhãn khung chat, Brief hay tài liệu — rồi dữ liệu thế vào đúng
 * chỗ. Chỉ nhớ một dự án (lần tải lại thường là dự án vừa mở); dự án khác ⇒ bố cục mặc định. Chỉ là gợi ý hiển thị.
 */
export const WORKSPACE_MEMORY_COOKIE = "ff_workspace";

export type WorkspaceMemoryPane = "none" | "brief" | "document";

export interface WorkspaceMemory {
  id: string;
  /** `import` = dự án tải SRS có sẵn (không rail, có panel Công cụ); `fpt` = soạn theo quy trình. */
  mode: "fpt" | "import";
  name: string;
  /** Giai đoạn đang làm (rail mở sẵn giai đoạn này); `null` khi chưa biết. */
  phase: string | null;
  pane: WorkspaceMemoryPane;
  /** Mức duyệt của AI (nhãn nút trên ô chat); `null` khi chưa biết. */
  review: ReviewMode | null;
}

const PANES: readonly WorkspaceMemoryPane[] = ["none", "brief", "document"];
const REVIEW_MODES: readonly ReviewMode[] = ["strict", "balanced", "fast", "milestones"];

export const parseWorkspaceMemory = (raw: string | null | undefined): WorkspaceMemory | null => {
  const value = parseJsonCookie(raw) as Partial<WorkspaceMemory> | null;
  if (!value || typeof value.id !== "string" || typeof value.name !== "string") return null;
  if (value.mode !== "fpt" && value.mode !== "import") return null;
  return {
    id: value.id,
    mode: value.mode,
    name: value.name,
    phase: typeof value.phase === "string" ? value.phase : null,
    pane: PANES.includes(value.pane as WorkspaceMemoryPane) ? (value.pane as WorkspaceMemoryPane) : "none",
    review: REVIEW_MODES.includes(value.review as ReviewMode) ? (value.review as ReviewMode) : null,
  };
};

export const readWorkspaceMemory = (): WorkspaceMemory | null => parseWorkspaceMemory(readBrowserCookie(WORKSPACE_MEMORY_COOKIE));

/** Ghi khi đổi — so chuỗi để không ghi cookie lặp mỗi lần render. */
export const writeWorkspaceMemory = (memory: WorkspaceMemory) => {
  const value = JSON.stringify(memory);
  if (readBrowserCookie(WORKSPACE_MEMORY_COOKIE) === value) return;
  writeBrowserCookie(WORKSPACE_MEMORY_COOKIE, value);
};

/** Đăng xuất: người sau trên cùng máy không thấy tên dự án của người trước. */
export const clearWorkspaceMemory = () => clearBrowserCookie(WORKSPACE_MEMORY_COOKIE);
