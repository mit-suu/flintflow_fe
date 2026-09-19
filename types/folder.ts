/** Màu thư mục — khớp `FOLDER_COLORS` ở BE (`modules/folder/folder.model.ts`); FE map sang token màu. */
export type FolderColor = "violet" | "blue" | "amber" | "green" | "rose";

/** `GET /folders`: thư mục của user kèm số dự án đang làm bên trong. */
export interface Folder {
  _id: string;
  name: string;
  color: FolderColor;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
}
