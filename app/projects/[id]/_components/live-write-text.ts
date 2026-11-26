import type { SpineWrittenEvent } from "@/types/project-events";

/** Hàm dịch của namespace `workspace.liveWrite` (truyền `useTranslations("workspace.liveWrite")`). */
export type LiveWriteTranslator = (key: "cr" | "edit" | "step" | "undo" | "someone" | "whereOne" | "whereMany", values?: Record<string, string | number>) => string;

/** Lần ghi có nên báo không: `system` (import, job nền) và lần ghi của chính mình chỉ tải mới, không báo. */
export const isNotifiableWrite = (event: SpineWrittenEvent, myUserId: string | null): boolean =>
  event.source !== "system" && (!myUserId || event.actor_user_id !== myUserId);

/**
 * Câu báo cho một lần ghi, dùng chung cho toast và chuông: "Lan vừa ghi CR-012 vào mục 3.1.2 Danh sách màn hình".
 * `sectionName` đổi id section sang số + tên mục đang hiển thị (không bao giờ hiện mã nội bộ).
 */
export const liveWriteText = (event: SpineWrittenEvent, sectionName: (id: string) => string, t: LiveWriteTranslator): string => {
  const name = event.actor_name || t("someone");
  const total = event.sections.length + event.more;
  const where = total === 1 ? t("whereOne", { section: sectionName(event.sections[0]) }) : t("whereMany", { count: total });
  if (event.source === "cr" && event.cr_id) return t("cr", { name, cr: event.cr_id, where });
  if (event.source === "step") return t("step", { name, where });
  if (event.source === "undo") return t("undo", { name, where });
  return t("edit", { name, where });
};
