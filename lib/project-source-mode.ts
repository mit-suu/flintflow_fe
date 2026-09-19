import type { IconName } from "@/components/ui/Icon";
import type { ProjectSourceMode } from "@/types/project";

/** Tone màu của mode — trùng tên với `BadgeTone` để truyền thẳng vào `Badge`. */
export type SourceModeTone = "info" | "warning" | "primary";

export interface SourceModeOption {
  value: ProjectSourceMode;
  label: string;
  /** Nhãn ngắn trên card dự án. */
  shortLabel: string;
  description: string;
  icon: IconName;
  tone: SourceModeTone;
  /** `soon`: màn của nhánh này chưa có — hiện nhưng không chọn được, kèm `Badge tone="soon"`. */
  status: "ready" | "soon";
}

/** Nguồn sự thật duy nhất ở FE cho 3 source mode (thứ tự = thứ tự hiện thẻ). */
export const SOURCE_MODE_OPTIONS = [
  {
    value: "edit_srs",
    label: "Upload SRS có sẵn",
    shortLabel: "SRS có sẵn",
    description: "Có file .docx — FlintFlow kiểm tra lỗ hổng và giúp sửa",
    icon: "upload",
    tone: "info",
    // Màn upload SRS (/projects/:id/import) đang ở nhánh khác — bật "ready" khi nhánh đó merge
    status: "soon",
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
    value: "fpt_template",
    label: "Chưa có template",
    shortLabel: "Mẫu FPT",
    description: "Dùng mẫu SRS FPT, bắt đầu từ ý tưởng / ghi chú",
    icon: "sparkle",
    tone: "primary",
    status: "ready",
  },
] as const satisfies readonly SourceModeOption[];

export const getSourceModeOption = (mode: ProjectSourceMode): SourceModeOption =>
  SOURCE_MODE_OPTIONS.find((o) => o.value === mode) ?? SOURCE_MODE_OPTIONS[2];

const START_SEGMENT: Record<ProjectSourceMode, string> = {
  edit_srs: "/import",
  customer_template: "/template",
  fpt_template: "",
};

/** Chỗ duy nhất map mode → route đầu tiên sau khi tạo dự án. */
export const getProjectStartRoute = (projectId: string, mode: ProjectSourceMode) =>
  `/projects/${projectId}${START_SEGMENT[mode]}`;
