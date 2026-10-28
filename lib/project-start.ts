import type { IconName } from "@/components/ui/Icon";
import type { ProjectStartKind, TemplateIntent } from "@/types/project";

/**
 * FLF-335 (business-flow §1 "Chọn chế độ"): người dùng **không chọn chế độ**. Lúc tạo dự án chỉ có hai lựa chọn, chế độ
 * thật (1 / 2 / 3 / 4) do Code suy ra sau khi so file với cấu trúc đích:
 *
 * | Lựa chọn | Cấu trúc đích | Đủ | Thiếu |
 * | Có sẵn · tự do | Mẫu chuẩn FlintFlow (tối thiểu) | Chế độ 1 | Chế độ 4 |
 * | Có sẵn · theo mẫu cố định | Chính mẫu đó | Chế độ 1 | Chế độ 3 |
 * | Mới · có mẫu bắt buộc | Chính mẫu đó | Chế độ 1 | Chế độ 3 |
 * | Mới · không mẫu | Mẫu chuẩn FlintFlow | — | Chế độ 2 |
 */
export interface ProjectStartOption {
  value: ProjectStartKind;
  /** Key nhóm chữ trong `app.projectStart.<key>.*` (`label`, `description`). */
  key: "new" | "existing";
  icon: IconName;
}

export const PROJECT_START_OPTIONS = [
  { value: "new", key: "new", icon: "sparkle" },
  { value: "existing", key: "existing", icon: "upload" },
] as const satisfies readonly ProjectStartOption[];

/** Ý định lúc tải file lên (bước 1.2): file theo một mẫu cố định hay cấu trúc tự do. */
export const TEMPLATE_INTENT_OPTIONS: readonly TemplateIntent[] = ["free", "fixed"];
