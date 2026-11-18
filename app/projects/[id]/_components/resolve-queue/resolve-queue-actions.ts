import type { Op } from "@/types/pipeline";
import type { PendingKind } from "@/types/pending-queue";
import { userErrorMessage } from "@/lib/api/error-messages";
import type { AssumptionDecision } from "../gate-helpers";
import { buildDecisionOps } from "../AssumptionSweepPanel";
import { buildDropOp } from "../AddendumTriagePanel";
import { WAIVE_REASON_MIN_LENGTH } from "../flag-rules";

export { WAIVE_REASON_MIN_LENGTH };

/**
 * Loại lời gọi AI tốn credit - dùng cho `estimateActionCost` (`ChatActionType`). `change_request` (chế độ 1, FLF-445) là
 * cả một CR: làm rõ + đề xuất theo lô + kiểm nhất quán, hook cộng ba giá.
 */
export type ChoiceCreditAction = "translate" | "change_instruction" | "change_request";

export interface ChoiceDef {
  /** Khoá lựa chọn, cũng là phần cuối của key i18n `choice.<kind>.<id>` và `result.<kind>.<id>`. */
  id: string;
  /** `text`: ô nhập nội dung; `reason`: ô lý do (>= 20 ký tự); `none`: bấm là áp dụng. */
  input: "none" | "text" | "reason";
  /** Thao tác gọi AI ⇒ hiện số credit ước tính trước khi áp dụng. */
  credit: ChoiceCreditAction | null;
  /** Hỏi xác nhận một bước trước khi ghi (Bỏ ghi chú). */
  confirm?: boolean;
  /** Chỉ điền sẵn ô chat, việc quyết xong ở chat chứ không ở thẻ. */
  handoff?: boolean;
  /** Chế độ 1: tạo một change request từ các cờ đang chọn (khoá khi đã có CR chạy / gói chờ Lead). */
  createsCr?: boolean;
}

const choice = (id: string, extra: Partial<Omit<ChoiceDef, "id">> = {}): ChoiceDef => ({
  id,
  input: "none",
  credit: null,
  ...extra,
});

/** Lựa chọn của từng loại việc, theo thứ tự hiện (phím 1-n). */
export const CHOICES: Record<PendingKind, ChoiceDef[]> = {
  assumption: [choice("right"), choice("wrong"), choice("other", { input: "text", credit: "translate" })],
  brief_note: [choice("keep"), choice("drop", { confirm: true }), choice("other", { input: "text" })],
  screen: [choice("detail"), choice("later")],
  flag_red: [choice("chat", { credit: "change_instruction", handoff: true }), choice("keep", { input: "reason" })],
  flag_yellow_group: [choice("chat", { credit: "change_instruction", handoff: true }), choice("waive", { input: "reason" })],
};

/**
 * Chế độ 1 (FLF-445): cờ đi qua change request, không bỏ qua được (BE `MODE1_NO_WAIVE`). Cả cờ đỏ lẫn nhóm cờ vàng: AI
 * đề xuất cách sửa (một CR), giữ nguyên + lý do, hoặc gõ hướng sửa khác (cũng một CR).
 */
const MODE1_FLAG_CHOICES: ChoiceDef[] = [
  choice("cr", { credit: "change_request", createsCr: true }),
  choice("keep", { input: "reason" }),
  choice("other", { input: "text", credit: "change_request", createsCr: true }),
];

/** Lựa chọn theo loại việc và chế độ dự án. */
export const choicesFor = (kind: PendingKind, mode1: boolean): ChoiceDef[] =>
  mode1 && (kind === "flag_red" || kind === "flag_yellow_group") ? MODE1_FLAG_CHOICES : CHOICES[kind];

/** Thân CR tạo từ nhóm cờ: nguồn Gap report, người yêu cầu do thẻ điền sẵn. */
export interface FlagGroupCrRequest {
  title: string;
  description: string;
  source: { kind: "gap_report"; ref: null; note: string };
  requester: string;
  flag_ids: string[];
}

/** Handler có sẵn của trang - thẻ không tự gọi API ghi nào khác. */
export interface ResolveQueueHandlers {
  /** `POST /changes` qua hàng ghi; `false` = ghi lỗi (trang đã báo lỗi). */
  submitOps: (ops: Op[]) => Promise<boolean>;
  /** Sửa giả định (gọi AI dịch): `applyAssumptionDecision({kind:"edit"})`. */
  decideAssumption: (decision: AssumptionDecision) => Promise<boolean>;
  markPlaceholder: (screenId: string) => Promise<boolean>;
  /** Ném lỗi khi BE từ chối. Trang tải lại Spine sau khi ghi. */
  keepFlag: (flagId: string, reason: string) => Promise<void>;
  waiveFlag: (flagId: string, reason: string) => Promise<void>;
  /** Điền sẵn ô chat + bật chip Sửa tài liệu; `false` = đang bị khoá (trang đã báo lý do). */
  startEditing: (prefill: string) => boolean;
  /** Một dòng gọn vào khung chat sau mỗi quyết định thành công. */
  postChatLine: (text: string) => void;
  showSection: (sectionId: string) => void;
  /** Chế độ 1: tạo CR từ nhóm cờ và chạy tiếp ở khung chat; trả mã CR, lỗi BE thì ném. */
  createCrFromFlags?: (req: FlagGroupCrRequest) => Promise<string>;
  /** AI vừa bắt đầu chạy giữa chuỗi ghi ⇒ dừng (ghi Spine lúc bước đang soạn làm bước 409). Hook gắn vào, trang không cần truyền. */
  isLocked?: () => boolean;
}

/** Phần của thẻ mà hành động cần biết. */
export interface ChoiceTarget {
  kind: PendingKind;
  /** Id giả định / ghi chú / màn. */
  entityId: string;
  /** Cờ còn mở của việc (cờ đỏ: một cờ; nhóm vàng: cả nhóm). */
  flagIds: string[];
  prefill: string;
  /** Chế độ 1: tên nhóm (tiêu đề CR), câu từng cờ (mô tả CR), người yêu cầu ghi trên CR. */
  title?: string;
  flagMessages?: Readonly<Record<string, string>>;
  requester?: string;
}

/** Câu hỏi + cờ của nhóm thành mô tả CR: chữ người dùng gõ (nếu có) rồi danh sách cờ đang chọn. */
export const crDescription = (target: Pick<ChoiceTarget, "flagIds" | "flagMessages">, text: string): string => {
  const lines = target.flagIds.map((id) => `- ${target.flagMessages?.[id] ?? id}`).join("\n");
  return text ? `${text}\n\n${lines}` : lines;
};

export type ChoiceOutcome =
  | { status: "done"; markSeen?: boolean; done?: number; total?: number; crId?: string }
  | { status: "handoff" }
  | { status: "failed"; message?: string }
  | { status: "partial"; done: number; total: number; message?: string; stoppedByAi?: boolean };

const fromBoolean = (ok: boolean): ChoiceOutcome => (ok ? { status: "done" } : { status: "failed" });

const errorMessageOf = (err: unknown): string => userErrorMessage(err);

/** Bỏ qua / giữ nguyên từng cờ tuần tự: dừng ở lỗi đầu tiên, trả số đã ghi được. */
const writeSequentially = async (ids: string[], reason: string, handlers: ResolveQueueHandlers, write: "waiveFlag" | "keepFlag"): Promise<ChoiceOutcome> => {
  let done = 0;
  for (const id of ids) {
    if (handlers.isLocked?.()) return { status: "partial", done, total: ids.length, stoppedByAi: true };
    try {
      await handlers[write](id, reason);
      done += 1;
    } catch (err) {
      return { status: "partial", done, total: ids.length, message: errorMessageOf(err) };
    }
  }
  return { status: "done", done, total: ids.length };
};

/**
 * Chạy một lựa chọn bằng đúng thao tác đã có ở trang. Không ném: mọi lỗi thành `failed` / `partial` để thẻ ở lại việc
 * hiện tại và hiện lỗi. `now` truyền vào để test cố định.
 */
export async function executeChoice(
  target: ChoiceTarget,
  choiceId: string,
  input: string,
  handlers: ResolveQueueHandlers,
  now: () => string = () => new Date().toISOString()
): Promise<ChoiceOutcome> {
  const text = input.trim();
  const { kind, entityId } = target;
  try {
    // Chế độ 1: một nhóm cờ (cờ đang chọn) thành một change request
    const isFlag = kind === "flag_red" || kind === "flag_yellow_group";
    if (isFlag && (choiceId === "cr" || (choiceId === "other" && text)) && handlers.createCrFromFlags && target.flagIds.length > 0) {
      const crId = await handlers.createCrFromFlags({
        title: target.title || target.prefill,
        description: crDescription(target, choiceId === "other" ? text : ""),
        source: { kind: "gap_report", ref: null, note: "Tạo từ hàng việc chờ quyết" },
        requester: target.requester ?? "",
        flag_ids: target.flagIds,
      });
      return { status: "done", crId, total: target.flagIds.length };
    }
    switch (kind) {
      case "assumption":
        if (choiceId === "right") return fromBoolean(await handlers.submitOps(buildDecisionOps(entityId, "confirmed", now())));
        if (choiceId === "wrong") return fromBoolean(await handlers.submitOps(buildDecisionOps(entityId, "rejected", now())));
        if (choiceId === "other" && text) return fromBoolean(await handlers.decideAssumption({ kind: "edit", id: entityId, statement: text }));
        break;
      case "brief_note":
        if (choiceId === "keep") return { status: "done", markSeen: true };
        if (choiceId === "drop") return fromBoolean(await handlers.submitOps([buildDropOp(entityId)]));
        // Model chỉ đọc `content_en` của ghi chú (BE context-projection) ⇒ ghi cả hai field bằng chữ user, không gọi AI dịch
        if (choiceId === "other" && text) {
          const reason = "User sửa ghi chú Brief khi giải quyết việc chờ quyết";
          return fromBoolean(
            await handlers.submitOps([
              { op: "set", path: `addendum[id=${entityId}].content`, value: text, reason },
              { op: "set", path: `addendum[id=${entityId}].content_en`, value: text, reason }
            ])
          );
        }
        break;
      case "screen":
        if (choiceId === "detail") return { status: "done", markSeen: true };
        if (choiceId === "later") return fromBoolean(await handlers.markPlaceholder(entityId));
        break;
      case "flag_red":
        if (choiceId === "chat") return handlers.startEditing(target.prefill) ? { status: "handoff" } : { status: "failed" };
        if (choiceId === "keep" && target.flagIds[0] && text.length >= WAIVE_REASON_MIN_LENGTH) {
          await handlers.keepFlag(target.flagIds[0], text);
          return { status: "done" };
        }
        break;
      case "flag_yellow_group":
        if (choiceId === "chat") return handlers.startEditing(target.prefill) ? { status: "handoff" } : { status: "failed" };
        if (choiceId === "waive" && target.flagIds.length > 0 && text.length >= WAIVE_REASON_MIN_LENGTH)
          return writeSequentially(target.flagIds, text, handlers, "waiveFlag");
        // Chế độ 1 không bỏ qua cờ: giữ nguyên từng cờ đang chọn, kèm cùng một lý do
        if (choiceId === "keep" && target.flagIds.length > 0 && text.length >= WAIVE_REASON_MIN_LENGTH)
          return writeSequentially(target.flagIds, text, handlers, "keepFlag");
        break;
    }
  } catch (err) {
    return { status: "failed", message: errorMessageOf(err) };
  }
  return { status: "failed" };
}
