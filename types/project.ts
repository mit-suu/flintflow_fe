import type { ImportStatus } from "./import";

export type ProjectStatus = "active" | "archived";

/**
 * Cách làm SRS (FLF-171) — khác `spine.project.working_mode` (fast/coaching):
 * `import` = mode 1 upload SRS có sẵn rồi sửa · `fpt` = mode 2 sinh theo template FPT · `customer_template` = chưa hỗ trợ (BE 501).
 */
export type ProjectMode = "import" | "fpt" | "customer_template";

/**
 * Ngôn ngữ tài liệu SRS (FLF-265) — khác ngôn ngữ giao diện. Mode 2: chọn khi tạo, đổi sau được; mode 1: theo file
 * (`TemplateProfile.language`), không đổi được.
 */
export type DocumentLanguage = "vi" | "en";

/**
 * Project theo `project.model.ts` BE — chỉ metadata danh sách. Nội dung, tiến độ và baseline nằm ở Spine
 * (`types/spine.ts`, `GET /projects/:id/spine`); tiến độ đọc từ `GET /projects/:id/progress`
 * (`ProgressResponse` ở `types/pipeline.ts`) — không có field tiến độ nào trên Project.
 */
export interface Project {
  _id: string;
  name: string;
  domain?: string | null;
  status: ProjectStatus;
  /** Project cũ (trước FLF-171) BE trả `fpt`. */
  mode: ProjectMode;
  /** Mode 1: trạng thái import rút gọn cho danh sách (UC-14, UC-19); mode khác `null`. */
  import_state: ImportStatus | null;
  /** Dự án cũ không có field: mode 2 đọc `en`, mode 1 theo ngôn ngữ file (BE suy ra). */
  documentLanguage?: DocumentLanguage;
  /** Thư mục chứa dự án (`GET /folders`); null/thiếu = ngoài thư mục. */
  folderId?: string | null;
  /** Lần mở gần nhất (BE ghi khi `GET /projects/:id`); null = chưa mở. */
  lastOpenedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  domain?: string;
  /** Không gửi ⇒ `fpt`. */
  mode?: ProjectMode;
  /** Không gửi ⇒ BE lấy ngôn ngữ tài khoản, rồi `en`. Mode `import` bỏ qua (ngôn ngữ theo file). */
  documentLanguage?: DocumentLanguage;
}
