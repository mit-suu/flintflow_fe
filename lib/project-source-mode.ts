import type { IconName } from "@/components/ui/Icon";
import type { Project, ProjectMode } from "@/types/project";

/** Tone màu của mode — trùng tên với `BadgeTone` để truyền thẳng vào `Badge`. */
export type SourceModeTone = "info" | "warning" | "primary";

export type SourceModeKey = "import" | "customerTemplate" | "fpt";

export interface SourceModeOption {
  value: ProjectMode;
  /** Key nhóm chữ trong `app.sourceMode.*` (`label`, `shortLabel`, `description`). */
  key: SourceModeKey;
  icon: IconName;
  tone: SourceModeTone;
}

/**
 * Nhãn / icon / tone để **hiển thị** 3 `ProjectMode` của BE (card dự án, bộ lọc). Từ FLF-335 người dùng không chọn mode —
 * thẻ tạo dự án là `ProjectStartPicker` (`lib/project-start.ts`); mode do BE suy ra.
 */
export const SOURCE_MODE_OPTIONS = [
  {
    value: "import",
    key: "import",
    icon: "upload",
    tone: "info",
  },
  {
    // Giá trị cũ, không còn được tạo (dự án mới có mẫu bắt buộc nay là `import`) — giữ để hiển thị dữ liệu cũ
    value: "customer_template",
    key: "customerTemplate",
    icon: "file-template",
    tone: "warning",
  },
  {
    // BE vẫn là `fpt` (mẫu SRS gốc của FPT); với người dùng đây là mẫu chuẩn FlintFlow
    value: "fpt",
    key: "fpt",
    icon: "sparkle",
    tone: "primary",
  },
] as const satisfies readonly SourceModeOption[];

/**
 * Nguồn của dự án để hiển thị: dự án tạo SRS đã chốt baseline chạy ở `mode = import` (FLF-318) nhưng vẫn là "Tạo SRS",
 * không phải "Upload SRS".
 */
export const projectSourceMode = (project: Pick<Project, "mode" | "converted_from">): ProjectMode =>
  project.converted_from === "fpt" ? "fpt" : project.mode;

export const getSourceModeOption = (mode: ProjectMode): SourceModeOption =>
  SOURCE_MODE_OPTIONS.find((o) => o.value === mode) ?? SOURCE_MODE_OPTIONS[2];

const START_SEGMENT: Record<ProjectMode, string> = {
  import: "/import",
  // Dự án cũ mang giá trị này đi cùng wizard tải file (FLF-335)
  customer_template: "/import",
  fpt: "",
};

/** Chỗ duy nhất map mode → route đầu tiên sau khi tạo dự án. */
export const getProjectStartRoute = (projectId: string, mode: ProjectMode) =>
  `/projects/${projectId}${START_SEGMENT[mode]}`;
