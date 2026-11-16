"use client";

import { useSyncExternalStore } from "react";
import { ApiClientError } from "@/lib/api/client";
import { uploadImport } from "@/lib/api/import";
import { importFromOrgTemplate } from "@/lib/api/org-library";
import { uploadReferenceDocument } from "@/lib/reference-upload";
import type { DocumentUploadChoice, DocumentVersionCandidate } from "@/types/document";

/**
 * Tải file của hộp Tạo dự án **sau khi đã vào trang dự án** (không bắt người dùng chờ trong hộp thoại): SRS (hoặc mẫu tổ chức) và
 * tài liệu tham khảo chạy song song, trạng thái từng file để trang dự án hiện các bước tích dần. Giữ trong bộ nhớ của tab — tải lại
 * trang giữa chừng thì mất (dự án vẫn còn, màn đọc file hiện lại ô tải SRS).
 *
 * FLF-398 (tài liệu tham khảo): tải **lần lượt** (BE bắt được cả file trùng nhau trong cùng lượt chọn). `choosing` = file có vẻ là
 * bản mới của tài liệu đã có, chờ người dùng chọn (`chooseProjectUploadVersion`); `skipped` = không tải — trùng hệt (`note` là câu
 * báo) hoặc người dùng Bỏ qua.
 */
export type UploadStatus = "uploading" | "done" | "failed" | "choosing" | "skipped";

export interface UploadItem {
  key: string;
  kind: "srs" | "reference";
  name: string;
  size: number | null;
  status: UploadStatus;
  /** `choosing`: tài liệu đang dùng mà file này có thể là bản mới của nó. */
  candidates?: DocumentVersionCandidate[];
  /** `skipped` vì trùng hệt: câu báo (đã dịch, nêu tài liệu đã có). */
  note?: string;
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
  /** FLF-398: file đang chờ người dùng chọn (`choosing`) ⇒ hàm trả lựa chọn cho lượt tải đang treo. */
  choices?: Map<string, (choice: DocumentUploadChoice | null) => void>;
}
const store: UploadsStore = ((globalThis as { __ffProjectUploads?: UploadsStore }).__ffProjectUploads ??= { state: new Map(), files: new Map(), listeners: new Set() });
const choices = (store.choices ??= new Map());
const { state, files, listeners } = store;
const emit = () => listeners.forEach((l) => l());

const patchItem = (projectId: string, key: string, patch: Partial<UploadItem>) => {
  const current = state.get(projectId);
  if (!current) return;
  state.set(projectId, { ...current, items: current.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) });
  emit();
};

const run = async (projectId: string, item: UploadItem, orgTemplate?: { id: string; version?: number }) => {
  patchItem(projectId, item.key, { status: "uploading", candidates: undefined, note: undefined });
  try {
    if (item.kind === "srs") {
      await (orgTemplate ? importFromOrgTemplate(projectId, orgTemplate.id, orgTemplate.version) : uploadImport(projectId, files.get(item.key)!));
      patchItem(projectId, item.key, { status: "done" });
      return;
    }
    const result = await uploadReferenceDocument(
      projectId,
      files.get(item.key)!,
      (_file, candidates) =>
        new Promise((resolve) => {
          choices.set(item.key, resolve);
          patchItem(projectId, item.key, { status: "choosing", candidates });
        })
    );
    patchItem(projectId, item.key, result.kind === "uploaded" ? { status: "done" } : { status: "skipped", note: result.kind === "duplicate" ? result.message : undefined });
  } catch (err) {
    // File bị preflight từ chối vẫn tạo lần import (lý do hiện ở màn đọc file) ⇒ coi như đã tải xong
    patchItem(projectId, item.key, { status: err instanceof ApiClientError && err.code === "IMPORT_FILE_REJECTED" ? "done" : "failed" });
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
  // SRS song song với tài liệu tham khảo; tài liệu tham khảo lần lượt (FLF-398: file sau so được với file trước)
  for (const item of items) if (item.kind === "srs") void run(projectId, item, orgTemplate);
  void (async () => {
    for (const item of items) if (item.kind === "reference") await run(projectId, item);
  })();
};

/** FLF-398: trả lời file đang `choosing` — Thay bản cũ / Giữ cả hai, hoặc `null` = Bỏ qua (không tải). */
export const chooseProjectUploadVersion = (projectId: string, key: string, choice: DocumentUploadChoice | null): void => {
  const resolve = choices.get(key);
  if (!resolve) return;
  choices.delete(key);
  patchItem(projectId, key, { status: "uploading", candidates: undefined });
  resolve(choice);
};

/** FLF-398: ẩn dòng báo của một file đã xong (vd file trùng hệt đã được báo). Hết dòng ⇒ bỏ theo dõi. */
export const dismissProjectUpload = (projectId: string, key: string): void => {
  const current = state.get(projectId);
  if (!current) return;
  files.delete(key);
  const items = current.items.filter((i) => i.key !== key);
  if (items.length) state.set(projectId, { ...current, items });
  else state.delete(projectId);
  emit();
};

/** Thử lại một file lỗi (file vẫn còn trong bộ nhớ của tab). */
export const retryProjectUpload = (projectId: string, key: string): void => {
  const item = state.get(projectId)?.items.find((i) => i.key === key);
  if (item && files.has(key)) void run(projectId, item);
};

/** Bỏ theo dõi khi mọi file đã xong và trang không cần hiện nữa. */
export const clearProjectUploads = (projectId: string): void => {
  const current = state.get(projectId);
  current?.items.forEach((i) => {
    files.delete(i.key);
    // File đang chờ chọn ⇒ coi như Bỏ qua, lượt tải đang treo kết thúc
    choices.get(i.key)?.(null);
    choices.delete(i.key);
  });
  state.delete(projectId);
  emit();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Còn file đang tải lên hoặc đang chờ người dùng chọn bản ở bất kỳ dự án nào trong tab — rời trang lúc này là mất file đó. */
const hasPendingUploads = () => [...state.values()].some((p) => p.items.some((i) => i.status === "uploading" || i.status === "choosing"));
export const useHasPendingUploads = (): boolean => useSyncExternalStore(subscribe, hasPendingUploads, () => false);

/** Trạng thái tải file của dự án; `null` khi không có lượt tải nào trong tab này. */
export const useProjectUploads = (projectId: string): ProjectUploads | null =>
  useSyncExternalStore(subscribe, () => state.get(projectId) ?? null, () => null);
