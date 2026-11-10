"use client";

import { useSyncExternalStore } from "react";
import { ApiClientError } from "@/lib/api/client";
import { uploadProjectDocument } from "@/lib/api/documents";
import { uploadImport } from "@/lib/api/import";
import { importFromOrgTemplate } from "@/lib/api/org-library";

/**
 * Tải file của hộp Tạo dự án **sau khi đã vào trang dự án** (không bắt người dùng chờ trong hộp thoại): SRS (hoặc mẫu tổ chức) và
 * tài liệu tham khảo chạy song song, trạng thái từng file để trang dự án hiện các bước tích dần. Giữ trong bộ nhớ của tab — tải lại
 * trang giữa chừng thì mất (dự án vẫn còn, màn đọc file hiện lại ô tải SRS).
 */
export type UploadStatus = "uploading" | "done" | "failed";

export interface UploadItem {
  key: string;
  kind: "srs" | "reference";
  name: string;
  size: number | null;
  status: UploadStatus;
}

export interface ProjectUploads {
  items: UploadItem[];
  startedAt: number;
  /** Tên vừa nhập ở hộp Tạo dự án — thanh trên hiện ngay, không chờ đọc project. */
  projectName?: string;
}

export interface ProjectFiles {
  projectName?: string;
  srs?: File | null;
  orgTemplate?: { id: string; name: string; /** Bản đã chọn; trống ⇒ bản đã đăng mới nhất. */ version?: number } | null;
  references: File[];
}

// Giữ trên `globalThis`: trang chủ (nơi bấm Tạo) và trang dự án có thể nằm ở hai chunk khác nhau — cùng một bản trạng thái cho cả tab
interface UploadsStore {
  state: Map<string, ProjectUploads>;
  files: Map<string, File>;
  listeners: Set<() => void>;
}
const store: UploadsStore = ((globalThis as { __ffProjectUploads?: UploadsStore }).__ffProjectUploads ??= { state: new Map(), files: new Map(), listeners: new Set() });
const { state, files, listeners } = store;
const emit = () => listeners.forEach((l) => l());

const setItem = (projectId: string, key: string, status: UploadStatus) => {
  const current = state.get(projectId);
  if (!current) return;
  state.set(projectId, { ...current, items: current.items.map((i) => (i.key === key ? { ...i, status } : i)) });
  emit();
};

const run = async (projectId: string, item: UploadItem, orgTemplate?: { id: string; version?: number }) => {
  setItem(projectId, item.key, "uploading");
  try {
    if (item.kind === "srs") await (orgTemplate ? importFromOrgTemplate(projectId, orgTemplate.id, orgTemplate.version) : uploadImport(projectId, files.get(item.key)!));
    else await uploadProjectDocument(projectId, files.get(item.key)!);
    setItem(projectId, item.key, "done");
  } catch (err) {
    // File bị preflight từ chối vẫn tạo lần import (lý do hiện ở màn đọc file) ⇒ coi như đã tải xong
    setItem(projectId, item.key, err instanceof ApiClientError && err.code === "IMPORT_FILE_REJECTED" ? "done" : "failed");
  }
};

let seq = 0;

/** Bắt đầu tải mọi file của dự án vừa tạo (không chờ). */
export const startProjectUploads = (projectId: string, input: ProjectFiles): void => {
  const items: UploadItem[] = [];
  const orgTemplate = input.orgTemplate ? { id: input.orgTemplate.id, version: input.orgTemplate.version } : undefined;
  if (input.srs || input.orgTemplate) {
    const key = `srs-${++seq}`;
    if (input.srs) files.set(key, input.srs);
    items.push({ key, kind: "srs", name: input.srs?.name ?? input.orgTemplate!.name, size: input.srs?.size ?? null, status: "uploading" });
  }
  for (const ref of input.references) {
    const key = `ref-${++seq}`;
    files.set(key, ref);
    items.push({ key, kind: "reference", name: ref.name, size: ref.size, status: "uploading" });
  }
  if (!items.length) return;
  state.set(projectId, { items, startedAt: Date.now(), projectName: input.projectName });
  emit();
  for (const item of items) void run(projectId, item, item.kind === "srs" ? orgTemplate : undefined);
};

/** Thử lại một file lỗi (file vẫn còn trong bộ nhớ của tab). */
export const retryProjectUpload = (projectId: string, key: string): void => {
  const item = state.get(projectId)?.items.find((i) => i.key === key);
  if (item && files.has(key)) void run(projectId, item);
};

/** Bỏ theo dõi khi mọi file đã xong và trang không cần hiện nữa. */
export const clearProjectUploads = (projectId: string): void => {
  const current = state.get(projectId);
  current?.items.forEach((i) => files.delete(i.key));
  state.delete(projectId);
  emit();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Trạng thái tải file của dự án; `null` khi không có lượt tải nào trong tab này. */
export const useProjectUploads = (projectId: string): ProjectUploads | null =>
  useSyncExternalStore(subscribe, () => state.get(projectId) ?? null, () => null);
