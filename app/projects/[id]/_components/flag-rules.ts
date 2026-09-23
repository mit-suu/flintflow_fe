import type { Flag, FlagRuleId } from "@/types/flags";

/**
 * Tên nhóm dễ hiểu cho từng luật cờ — thay mã luật (`unconfirmed_assumption`) trên giao diện.
 * Khoá theo `FlagRuleId` (TS báo thiếu khi type thêm luật) cộng các luật BE đang phát mà type chưa liệt kê.
 * Luật lạ (BE thêm sau) ⇒ `flagGroupTitle` trả null, panel rơi về câu `message` của chính cờ.
 */
const RULE_TITLE: Record<FlagRuleId, string> & Record<string, string> = {
  section_empty: "Mục còn trống",
  array_empty: "Danh sách bắt buộc còn trống",
  dead_reference: "Tham chiếu tới phần đã xoá",
  render_error: "Sơ đồ vẽ bị lỗi",
  diagram_stale: "Sơ đồ đã cũ",
  nfr_missing_number: "Yêu cầu phi chức năng thiếu con số đo được",
  unconfirmed_assumption: "Giả định chưa xác nhận",
  section_stale_at_baseline: "Mục cần viết lại",
  section_awaiting_reaccept: "Mục chờ duyệt lại",
  screen_pending_at_baseline: "Màn hình chưa đặc tả xong",
  orphan_actor: "Actor không tham gia use case nào",
  usecase_no_function: "Use case chưa có chức năng",
  screen_no_function: "Màn hình chưa có chức năng",
  empty_feature: "Feature chưa có chức năng",
  role_no_actor: "Vai trò không gắn actor",
  non_english_content: "Nội dung chưa viết bằng tiếng Anh",
  // BE phát nhưng type FE chưa liệt kê
  derived_from_changed_assumption: "Dựa trên giả định đã bị đổi",
  screen_placeholder: "Màn hình để trống có chủ đích",
  orphan_screen_at_baseline: "Màn hình không gắn chức năng",
  system_name_missing: "Thiếu tên hệ thống",
  actor_name_shape: "Tên actor chưa đúng dạng",
  function_without_uc: "Chức năng không thuộc use case nào",
  usecase_floating: "Use case không gắn actor",
  usecase_relation_invalid: "Quan hệ giữa use case không hợp lệ",
  usecase_auth_relation: "Quan hệ đăng nhập của use case",
  goal_not_covered: "Mục tiêu chưa được đáp ứng",
  accepted_as_is: "Đã chấp nhận nguyên trạng",
};

export const flagGroupTitle = (ruleId: string): string | null => RULE_TITLE[ruleId] ?? null;

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

export type IssueAction = "confirm" | "run_step" | "reaccept" | "redraw" | "fix";

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

/** Thứ tự hiện + tiêu đề + một câu nói rõ vì sao và phải làm gì. */
export const ACTION_INFO: Record<IssueAction, { title: string; hint: string }> = {
  confirm: { title: "Cần bạn xác nhận", hint: "AI tự giả định — cho biết đúng hay sai." },
  fix: { title: "Cần bạn sửa nội dung", hint: "Nội dung còn thiếu hoặc chưa đúng." },
  reaccept: { title: "Cần bạn duyệt lại", hint: "Nội dung đã đổi sau khi bạn chốt." },
  redraw: { title: "Vẽ lại sơ đồ", hint: "Sơ đồ chưa khớp nội dung mới." },
  run_step: { title: "Sẽ điền ở bước sau", hint: "Chưa phải lỗi — AI điền khi chạy tới các bước này." },
};
export const ACTION_ORDER: readonly IssueAction[] = ["confirm", "fix", "reaccept", "redraw", "run_step"];

export interface ActionGroup {
  action: IssueAction;
  flags: Flag[];
}

/** Gom cờ theo việc phải làm, theo `ACTION_ORDER`; bỏ nhóm rỗng. */
export const groupByAction = (flags: readonly Flag[]): ActionGroup[] =>
  ACTION_ORDER.map((action) => ({ action, flags: flags.filter((f) => actionOf(f.rule_id) === action) })).filter((g) => g.flags.length > 0);

export interface IssueCounts {
  /** Vấn đề thật phải xử lý trước khi chốt bản: cờ đỏ (trừ "sẽ điền ở bước sau") + mục cần viết lại. */
  blocking: number;
  /** Gợi ý nên xem: cờ vàng (trừ "sẽ điền ở bước sau"). */
  suggestions: number;
  /** Số mục còn trống vì bước viết ra nó chưa chạy — không phải lỗi, không tính vào hai số trên. */
  later: number;
}

const isOpenFlag = (f: Flag) => !f.resolved_at && !f.waived_by_user;

/** Đếm cho chip trạng thái, câu tóm tắt và số trên tab — cùng một định nghĩa ở mọi chỗ. */
export const issueCounts = (flags: readonly Flag[], outdated = 0): IssueCounts => {
  const open = flags.filter(isOpenFlag);
  const now = open.filter((f) => actionOf(f.rule_id) !== "run_step");
  return {
    blocking: now.filter((f) => f.level === "red").length + outdated,
    suggestions: now.filter((f) => f.level === "yellow").length,
    later: new Set(open.filter((f) => actionOf(f.rule_id) === "run_step").map((f) => f.section_id)).size,
  };
};
