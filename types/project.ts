export type ProjectStatus = "active" | "archived";

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
  createdAt: string;
  updatedAt: string;
}
