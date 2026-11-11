import type { Flag } from "@/types/spine";

export const MIGRATION_MISSING_RULE = "template_section_migration_missing";

/** Cờ đỏ "mục của mẫu mới chưa có nội dung" còn mở — đếm cho thẻ mục thiếu và lý do chặn phát hành. */
export const openMigrationMissing = (flags: readonly Flag[]): Flag[] =>
  flags.filter((f) => f.rule_id === MIGRATION_MISSING_RULE && f.level === "red" && !f.resolved_at && !f.waived_by_user);

/**
 * Tên mục của chính lá cờ: BE ghi heading của mẫu mới vào câu cờ (`Mục "<heading>" có trong mẫu mới…`). Dùng thay cho tra theo
 * `section_id` vì mẫu đích có thể có nhiều heading cùng `section_id` (tra theo id ra heading khác với câu cờ), và ngay sau áp dụng
 * tài liệu trong workspace chưa đọc lại nên tên theo tài liệu còn cũ. Câu cờ không theo mẫu này ⇒ `null`.
 */
export const migrationMissingLabel = (flag: Pick<Flag, "message">): string | null => {
  const m = /^Mục "(.+?)" có trong mẫu mới/.exec(flag.message ?? "");
  return m ? m[1] : null;
};
