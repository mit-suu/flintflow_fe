import type { Flag } from "@/types/spine";
import type { MissingItem } from "@/types/template-migration";

export const MIGRATION_MISSING_RULE = "template_section_migration_missing";

/**
 * Cờ đỏ "mục của mẫu mới chưa có nội dung" còn mở — đếm cho thẻ mục thiếu và lý do chặn phát hành. Có `missing` của lần đổi mẫu thì
 * bỏ cờ của mục in từ dữ liệu Spine (`filled_from_spine`): mục đó đã có nội dung, không phải viết.
 */
export const openMigrationMissing = (flags: readonly Flag[], missing: readonly MissingItem[] = []): Flag[] =>
  flags.filter((f) => f.rule_id === MIGRATION_MISSING_RULE && f.level === "red" && !f.resolved_at && !f.waived_by_user && !isSpineFilled(f, missing));

/**
 * Cờ trỏ tới mục in từ Spine: khớp theo heading trong câu cờ; câu cờ không có heading thì theo `section_id`, chỉ khi không còn mục thiếu
 * nào khác cùng `section_id` phải viết (mẫu có thể có nhiều heading cùng id).
 */
const isSpineFilled = (flag: Pick<Flag, "message" | "section_id">, missing: readonly MissingItem[]): boolean => {
  const label = migrationMissingLabel(flag);
  if (label !== null) return missing.some((m) => m.filled_from_spine && m.heading_text === label);
  const same = missing.filter((m) => m.section_id === flag.section_id);
  return same.length > 0 && same.every((m) => m.filled_from_spine);
};

/**
 * Tên mục của chính lá cờ: BE ghi heading của mẫu mới vào câu cờ (`Mục "<heading>" có trong mẫu mới…`). Dùng thay cho tra theo
 * `section_id` vì mẫu đích có thể có nhiều heading cùng `section_id` (tra theo id ra heading khác với câu cờ), và ngay sau áp dụng
 * tài liệu trong workspace chưa đọc lại nên tên theo tài liệu còn cũ. Câu cờ không theo mẫu này ⇒ `null`.
 */
export const migrationMissingLabel = (flag: Pick<Flag, "message">): string | null => {
  const m = /^Mục "(.+?)" có trong mẫu mới/.exec(flag.message ?? "");
  return m ? m[1] : null;
};
