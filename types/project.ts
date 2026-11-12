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

/** Ký pháp vẽ ERD của cả dự án (FLF-324). Đổi ⇒ BE vẽ lại hình ERD đã có. */
export type ErdNotation = "chen" | "crowsfoot" | "idef1x";

/** FLF-410: nền tảng vẽ mockup màn. */
export type ScreenPlatform = "web" | "mobile";

/**
 * Theme mockup §3.x.y Screen Layout (FLF-410). Field `null` = chưa chọn: màu ⇒ màu mặc định, domain ⇒ thanh địa chỉ chỉ hiện
 * đường dẫn, nền tảng ⇒ BE suy từ mô tả dự án. Đổi ⇒ BE vẽ lại mockup đã có từ spec đã lưu, không trừ credit.
 */
export interface ScreenTheme {
  primaryColor: string | null;
  domain: string | null;
  platforms: ScreenPlatform[] | null;
}

/** FLF-410: `system` = mockup chuẩn FlintFlow; `original` = theo bố cục ảnh gốc (gửi kèm ảnh, tốn token hơn). */
export type ScreenMockupMode = "system" | "original";
export type ScreenMockupScope = "screen" | "all";

export interface ScreenMockupState {
  screen_id: string;
  mode: ScreenMockupMode;
  enabled: boolean;
  image_indexes: number[];
}

/** `GET /projects/:id/screen-mockups` không `mode`. */
export interface ScreenMockupSummary {
  with_original: number;
  using_mockup: number;
  screens: ScreenMockupState[];
  originals: { screen_id: string; section_id: string; name: string }[];
}

/** `GET /projects/:id/screen-mockups?mode&scope` — ước tính, không gọi model. */
export interface ScreenMockupEstimate {
  screens: number;
  ai_calls: number;
  credits: number;
  /** Màn đã vẽ đúng kiểu nhưng đang dùng ảnh gốc ⇒ bật lại, 0 credit. */
  reenable: number;
  /** Mỗi màn đúng một nhóm (cộng lại = `screens`): AI vẽ mới / bật lại hình đã vẽ / đã là mockup kiểu này ⇒ bỏ qua. */
  groups: { draw: string[]; reenable: string[]; skip: string[] };
}

/**
 * Lượt "Vẽ lại bằng mockup" chạy nền — `POST /screen-mockups` (202) và `GET /screen-mockups/run`. `interrupted` = tiến trình BE
 * chết giữa chừng. Màn lỗi / chưa vẽ giữ ảnh gốc.
 */
export interface ScreenMockupRunView {
  run_id: string;
  status: "running" | "done" | "cancelled" | "interrupted";
  /** Đã bấm Dừng, đang vẽ nốt màn hiện tại. */
  stopping: boolean;
  total: number;
  completed: number;
  done: string[];
  failed: { screen_id: string; reason: string }[];
  fell_back_to_system: string[];
  /** Màn còn chờ vẽ. */
  pending: string[];
  suggested_color: string | null;
}

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
  /** FLF-324: BE luôn trả; dự án cũ `chen`. Thiếu field (BE cũ) ⇒ coi là `chen`. */
  erdNotation?: ErdNotation;
  /** FLF-410: BE luôn trả; dự án cũ / BE cũ thiếu ⇒ coi như mọi field `null`. */
  screenTheme?: ScreenTheme;
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
  /**
   * Hộp Tạo dự án hai ô (business-flow §1): có tải file SRS không. Có trường này thì BE bỏ qua `source` / `mode` — không SRS ⇒
   * chế độ 2; có SRS ⇒ giữ khung của file, trừ khi `complete_to_standard`.
   */
  has_srs_file?: boolean;
  /** Ô chọn "Bổ sung các mục còn thiếu theo mẫu chuẩn FlintFlow" — chỉ có nghĩa khi có file SRS. */
  complete_to_standard?: boolean;
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
