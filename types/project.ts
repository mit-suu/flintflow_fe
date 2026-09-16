export type ProjectStatus = "active" | "archived";

/**
 * Project theo `project.model.ts` BE — chỉ metadata danh sách. Nội dung, tiến độ và baseline nằm ở Spine
 * (`types/spine.ts`, `GET /projects/:id/spine`, `GET /projects/:id/progress`).
 */
export interface Project {
  _id: string;
  name: string;
  domain?: string | null;
  status: ProjectStatus;
  /**
   * @deprecated BE đã gỡ ở T21 — project từ BE thật KHÔNG còn field này (runtime là `undefined`). Còn
   * khai báo tạm vì `components/ProjectCard.tsx` và `mocks/state.ts` (ngoài vùng T21) vẫn đọc; chuyển
   * sang tiến độ của Spine rồi xoá hai field này ở T23 (XREQ T21→T23).
   */
  currentStep: string;
  /** @deprecated Xem `currentStep`. % tiến độ là hàm tính ở BE (`GET /projects/:id/progress`). */
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
}
