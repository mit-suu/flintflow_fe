import type { IconName } from "@/components/ui/Icon";
import type { ProjectMode } from "@/types/project";

/** Tone màu của mode — trùng tên với `BadgeTone` để truyền thẳng vào `Badge`. */
export type SourceModeTone = "info" | "warning" | "primary";

export interface SourceModeOption {
  value: ProjectMode;
  label: string;
  /** Nhãn ngắn trên card dự án. */
  shortLabel: string;
  description: string;
  icon: IconName;
  tone: SourceModeTone;
  /** `soon`: màn của nhánh này chưa có — hiện nhưng không chọn được, kèm `Badge tone="soon"`. */
  status: "ready" | "soon";
}

/** Nguồn sự thật duy nhất ở FE cho 3 `ProjectMode` của BE (thứ tự = thứ tự hiện thẻ). */
export const SOURCE_MODE_OPTIONS = [
  {
    value: "import",
    label: "Upload SRS có sẵn",
    shortLabel: "SRS có sẵn",
    description: "Có file .docx — FlintFlow kiểm tra lỗ hổng và giúp sửa",
    icon: "upload",
    tone: "info",
    // Mode 1: tạo xong vào wizard /projects/:id/import
    status: "ready",
  },
  {
    value: "customer_template",
    label: "Có template của khách",
    shortLabel: "Template khách",
    description: "Upload mẫu của khách, viết SRS mới theo mẫu đó",
    icon: "file-template",
    tone: "warning",
    status: "soon",
  },
  {
    value: "fpt",
    label: "Chưa có template",
    // BE vẫn là `fpt` (mẫu SRS gốc của FPT); với người dùng đây là template của chính FlintFlow
    shortLabel: "Template FlintFlow",
    description: "Dùng template SRS của FlintFlow, bắt đầu từ ý tưởng / ghi chú",
    icon: "sparkle",
    tone: "primary",
    status: "ready",
  },
] as const satisfies readonly SourceModeOption[];

export const getSourceModeOption = (mode: ProjectMode): SourceModeOption =>
  SOURCE_MODE_OPTIONS.find((o) => o.value === mode) ?? SOURCE_MODE_OPTIONS[2];

const START_SEGMENT: Record<ProjectMode, string> = {
  import: "/import",
  customer_template: "/template",
  fpt: "",
};

/** Chỗ duy nhất map mode → route đầu tiên sau khi tạo dự án. */
export const getProjectStartRoute = (projectId: string, mode: ProjectMode) =>
  `/projects/${projectId}${START_SEGMENT[mode]}`;
