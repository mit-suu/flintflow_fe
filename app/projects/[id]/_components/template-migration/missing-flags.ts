import type { Flag } from "@/types/spine";

export const MIGRATION_MISSING_RULE = "template_section_migration_missing";

/** Cờ đỏ "mục của mẫu mới chưa có nội dung" còn mở — đếm cho thẻ mục thiếu và lý do chặn phát hành. */
export const openMigrationMissing = (flags: readonly Flag[]): Flag[] =>
  flags.filter((f) => f.rule_id === MIGRATION_MISSING_RULE && f.level === "red" && !f.resolved_at && !f.waived_by_user);
