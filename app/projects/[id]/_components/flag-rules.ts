import type { Flag, FlagRuleId } from "@/types/flags";

/**
 * Luật cờ có tên nhóm dễ hiểu (`messages → workspace.flagRules`) — thay mã luật (`unconfirmed_assumption`) trên giao diện.
 * Khoá theo `FlagRuleId` (TS báo thiếu khi type thêm luật) cộng các luật BE đang phát mà type chưa liệt kê.
 * Luật lạ (BE thêm sau) ⇒ `flagGroupTitle` trả null, panel rơi về câu `message` của chính cờ.
 */
const EXTRA_RULES = [
  // BE phát nhưng type FE chưa liệt kê
  "derived_from_changed_assumption",
  "screen_placeholder",
  "orphan_screen_at_baseline",
  "system_name_missing",
  "actor_name_shape",
  // Mode 1 §4.13: hình người dùng vẽ sẵn không còn khớp dữ liệu — mở CR để thay bằng sơ đồ vẽ lại
  "original_diagram_stale",
  "function_without_uc",
  "usecase_floating",
  "usecase_relation_invalid",
  "usecase_auth_relation",
  "goal_not_covered",
  "accepted_as_is",
] as const;

export type FlagRuleTitleKey = FlagRuleId | (typeof EXTRA_RULES)[number];

const HAS_TITLE: Record<FlagRuleId, true> = {
  section_empty: true,
  array_empty: true,
  dead_reference: true,
  render_error: true,
  diagram_stale: true,
  nfr_missing_number: true,
  unconfirmed_assumption: true,
  section_stale_at_baseline: true,
  section_awaiting_reaccept: true,
  screen_pending_at_baseline: true,
  orphan_actor: true,
  usecase_no_function: true,
  screen_no_function: true,
  empty_feature: true,
  role_no_actor: true,
  non_english_content: true,
};

const isTitledRule = (ruleId: string): ruleId is FlagRuleTitleKey =>
  ruleId in HAS_TITLE || (EXTRA_RULES as readonly string[]).includes(ruleId);

/** `t` = `useTranslations("workspace.flagRules")`. */
export const flagGroupTitle = (ruleId: string, t: (key: FlagRuleTitleKey) => string): string | null =>
  isTitledRule(ruleId) ? t(ruleId) : null;

/**
 * Luật mà câu của BE chỉ nhắc lại "mục X có vấn đề" (`Section bắt buộc fixed:3.1.2 chưa có dữ liệu`) — tên nhóm đã
 * nói vấn đề là gì, nên mỗi dòng chỉ cần tên mục.
 */
const SECTION_LEVEL_RULES = new Set(["section_empty", "section_stale_at_baseline", "section_awaiting_reaccept"]);
export const isSectionLevelRule = (ruleId: string): boolean => SECTION_LEVEL_RULES.has(ruleId);

/** Câu của BE có thể chứa mã mục nội bộ (`fixed:3.1.2`) — thay bằng tên mục đọc được. */
export const readableMessage = (message: string, sectionId: string, sectionLabel: string | undefined): string =>
  sectionLabel ? message.split(sectionId).join(sectionLabel) : message;

// ─── gom theo việc người dùng phải làm (không theo luật) ─────────────

export type IssueAction = "confirm" | "run_step" | "fill" | "reaccept" | "redraw" | "fix";

const ACTION_OF_RULE: Record<string, IssueAction> = {
  unconfirmed_assumption: "confirm",
  section_empty: "run_step",
  array_empty: "run_step",
  screen_pending_at_baseline: "run_step",
  usecase_no_function: "run_step",
  screen_no_function: "run_step",
  empty_feature: "run_step",
  orphan_screen_at_baseline: "run_step",
  section_awaiting_reaccept: "reaccept",
  section_stale_at_baseline: "reaccept",
  diagram_stale: "redraw",
  render_error: "redraw",
};

/** Luật chưa xếp ⇒ "fix" (nội dung có chỗ chưa đúng, sửa ở bước gốc hoặc bằng lệnh sửa trong chat). */
export const actionOf = (ruleId: string): IssueAction => ACTION_OF_RULE[ruleId] ?? "fix";

/**
 * FLF-248: "sẽ điền ở bước sau" chỉ đúng khi bước sở hữu CHƯA chốt. Bước đã chốt mà mục vẫn rỗng thì không
 * còn bước nào điền nữa — BE vẫn coi cờ đỏ đó chặn ký baseline, nên panel phải đếm và cho đường xử lý.
 */
export const actionOfFlag = (flag: Pick<Flag, "rule_id" | "remediation_step">, acceptedSteps?: ReadonlySet<string>): IssueAction => {
  const action = actionOf(flag.rule_id);
  return action === "run_step" && acceptedSteps?.has(flag.remediation_step) ? "fill" : action;
};

/** Thứ tự hiện các nhóm. Tiêu đề + câu giải thích của mỗi nhóm: `workspace.flags.action.<action>`. */
export const ACTION_ORDER: readonly IssueAction[] = ["confirm", "fix", "fill", "reaccept", "redraw", "run_step"];

export interface ActionGroup {
  action: IssueAction;
  flags: Flag[];
}

/** Gom cờ theo việc phải làm, theo `ACTION_ORDER`; bỏ nhóm rỗng. */
export const groupByAction = (flags: readonly Flag[], acceptedSteps?: ReadonlySet<string>): ActionGroup[] =>
  ACTION_ORDER.map((action) => ({ action, flags: flags.filter((f) => actionOfFlag(f, acceptedSteps) === action) })).filter(
    (g) => g.flags.length > 0
  );

export interface IssueCounts {
  /** Vấn đề thật phải xử lý trước khi chốt bản: cờ đỏ (trừ "sẽ điền ở bước sau") + mục cần viết lại. */
  blocking: number;
  /** Gợi ý nên xem: cờ vàng (trừ "sẽ điền ở bước sau"). */
  suggestions: number;
  /** Số mục còn trống vì bước viết ra nó chưa chạy — không phải lỗi, không tính vào hai số trên. */
  later: number;
}

// FLF-329 (BR-04): cờ đỏ đã waive / giữ nguyên vẫn mở, vẫn chặn
const isOpenFlag = (f: Flag) => !f.resolved_at && (f.level === "red" || !f.waived_by_user);

/**
 * Đếm cho chip trạng thái, câu tóm tắt và số trên tab — cùng một định nghĩa ở mọi chỗ. `acceptedSteps`: các bước
 * đã chốt (xem `actionOfFlag`); thiếu thì mọi cờ "rỗng" coi như còn chờ bước sau.
 */
export const issueCounts = (flags: readonly Flag[], outdated = 0, acceptedSteps?: ReadonlySet<string>): IssueCounts => {
  const open = flags.filter(isOpenFlag);
  const isLater = (f: Flag) => actionOfFlag(f, acceptedSteps) === "run_step";
  const now = open.filter((f) => !isLater(f));
  return {
    blocking: now.filter((f) => f.level === "red").length + outdated,
    suggestions: now.filter((f) => f.level === "yellow").length,
    later: new Set(open.filter(isLater).map((f) => f.section_id)).size,
  };
};

/** Lý do bỏ qua một cờ phải dài ít nhất chừng này ký tự (in kèm trong tài liệu). */
export const WAIVE_REASON_MIN_LENGTH = 20;
