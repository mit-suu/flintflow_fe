/**
 * Màn đổi mẫu là popup trên workspace, mở bằng query `panel=template` (cùng khuôn với gap report / change request ở `Mode1Popup`).
 * `template_id` + `version` điền sẵn đích (nút "Cập nhật" của thông báo bản mới).
 */
export const templateMigrationHref = (projectId: string, target?: { templateId: string; version: number }): string => {
  const params = new URLSearchParams({ panel: "template" });
  if (target) {
    params.set("template_id", target.templateId);
    params.set("version", String(target.version));
  }
  return `/projects/${projectId}?${params.toString()}`;
};

export interface MigrationTargetQuery {
  templateId: string;
  version: number;
}

/** Đọc đích điền sẵn từ query; thiếu hoặc sai kiểu ⇒ `null` (người dùng tự chọn). */
export const readMigrationTarget = (params: URLSearchParams): MigrationTargetQuery | null => {
  const templateId = params.get("template_id");
  const version = Number(params.get("version"));
  return templateId && Number.isInteger(version) && version >= 1 ? { templateId, version } : null;
};
