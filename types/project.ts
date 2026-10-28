import type { ImportStatus } from "./import";

export type ProjectStatus = "active" | "archived";

/**
 * Cách làm SRS (FLF-171) — khác `spine.project.working_mode` (fast/coaching). Từ FLF-335 **Code suy ra**, FE không gửi:
 * `import` = tải file lên (SRS có sẵn, hoặc mẫu bắt buộc của dự án mới) rồi so cấu trúc đích · `fpt` = dự án mới không mẫu,
 * soạn theo mẫu chuẩn FlintFlow · `customer_template` = giá trị cũ, không còn được tạo.
 */
export type ProjectMode = "import" | "fpt" | "customer_template";

/** FLF-335 (business-flow §1): lựa chọn duy nhất lúc tạo — dự án mới hay dự án có sẵn. */
export type ProjectStartKind = "new" | "existing";
/** Ý định với file tải lên (bước 1.2): theo một mẫu cố định (mẫu khách / công ty) hay cấu trúc tự do. */
export type TemplateIntent = "fixed" | "free";

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
  /** FLF-335: lựa chọn lúc tạo; dự án cũ `null` / thiếu. */
  start_kind?: ProjectStartKind | null;
  /** FLF-335: dự án mới có mẫu bắt buộc ⇒ `fixed` ngay lúc tạo; dự án có sẵn ⇒ ghi lúc upload; dự án cũ `null`. */
  template_intent?: TemplateIntent | null;
  has_required_template?: boolean | null;
  /** Mode 1: trạng thái import rút gọn cho danh sách (UC-14, UC-19); mode khác `null`. */
  import_state: ImportStatus | null;
  /**
   * FLF-318: dự án tạo SRS (`fpt`) đã được Lead chốt baseline và tự chuyển sang `mode = import` (sửa qua change request).
   * Nguồn hiển thị vẫn là "Tạo SRS". Thiếu / `null` = không chuyển.
   */
  converted_from?: "fpt" | null;
  converted_at?: string | null;
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
  /** FLF-335: `new` / `existing` — BE suy ra `mode`. Thiếu cả `source` lẫn `mode` ⇒ `fpt`. */
  source?: ProjectStartKind;
  /** Chỉ với `source: "new"`: khách có bắt buộc theo một mẫu không (có ⇒ sang màn tải mẫu). */
  has_required_template?: boolean;
  /** Cũ (trước FLF-335): client gửi thẳng mode. Có `source` thì BE bỏ qua. */
  mode?: ProjectMode;
  /** Tạo thẳng trong thư mục. */
  folderId?: string;
  /** Không gửi ⇒ BE lấy ngôn ngữ tài khoản, rồi `en`. Dự án tải file lên bỏ qua (ngôn ngữ theo file). */
  documentLanguage?: DocumentLanguage;
}
