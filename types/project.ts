export type ProjectStatus = "active" | "archived";

/**
 * Nguồn khởi đầu của dự án (BE `SOURCE_MODES`, `project.model.ts`) — quyết định nhánh BPMN:
 * `edit_srs` Flow 1 (upload SRS có sẵn), `fpt_template` Flow 2.1 (mẫu FPT), `customer_template` Flow 2.2
 * (template khách). Chọn khi tạo, không đổi được. Khác `WorkingMode` (fast/coaching) ở `types/spine.ts`.
 */
export type ProjectSourceMode = "edit_srs" | "fpt_template" | "customer_template";

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
  /** Luôn có: dự án tạo trước khi có field được BE migrate thành `fpt_template`. */
  sourceMode: ProjectSourceMode;
  createdAt: string;
  updatedAt: string;
}
