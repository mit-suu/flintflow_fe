"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import DropdownMenu from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import { REGENERATE_LIMIT } from "@/lib/constants/step-registry";
import type { AssumptionBrief, ChangeSummary, GateAction, GateReadyEvent } from "@/types/pipeline";
import GateFlags, { type GateNewFlag } from "./GateFlags";
import GateTable from "./GateTable";
import QuickReplyChips, { QuickReplyChip } from "./QuickReplyChips";
import { fallbackGateMessage, type BlockingFlag, type GateHelpersT } from "./gate-helpers";

// Các helper thuần nằm ở `gate-helpers.ts`; re-export để nơi khác (page, activity-log, test) giữ nguyên đường import.
export { PICKABLE_FIELDS, groupSummary, joinSummaryTexts, projectFieldText } from "./gate-helpers";
export type { AssumptionDecision, BlockingFlag, GateHelpersT, PickablePath } from "./gate-helpers";
export type { GateNewFlag } from "./GateFlags";

/** Bước ký baseline: Accept ở đây chụp bản chốt (BE `SIGN_OFF_STEP`). */
const SIGN_OFF_STEP = "S-9.5";

interface GateCardProps {
  stepId: string;
  /** Hành động BE cho phép (sự kiện `gate_ready`). */
  actions: GateAction[];
  regenerateUsed: number;
  regenerateLimit?: number;
  busy?: boolean;
  /** Lời AI (`message_vi`) của cổng này; vắng (dự án cũ) ⇒ dựng câu tạm từ tóm tắt. */
  message?: string;
  /** Có ⇒ đây là cổng chốt cuối giai đoạn: tóm tắt của CẢ giai đoạn, gồm cả bước đã tự Accept. */
  phaseSummary?: ChangeSummary[];
  /** Toàn bộ payload `gate_ready` — tóm tắt, bảng, lý do không đổi. */
  payload?: GateReadyEvent | null;
  /**
   * Giả định tin của cổng NÀY đã nói (cổng bước ⇒ `new_assumptions` của bước; cổng cuối giai đoạn ⇒ của cả giai đoạn).
   * Bấm "Đúng rồi, đi tiếp" chỉ xác nhận đúng chừng đó; giả định khác còn treo để dành cho danh sách rà ở B-2.1 / S-9.1.
   * Vắng ⇒ lấy `payload.new_assumptions`.
   */
  spokenAssumptions?: AssumptionBrief[];
  /** Giả định đã xác nhận/bỏ trong Spine — `gate_ready` khôi phục sau reload vẫn mang chúng, không xác nhận lại. */
  settledAssumptionIds?: ReadonlySet<string>;
  /** Chờ ghi xong xác nhận giả định rồi mới chốt bước. */
  onConfirmAssumptions?: (ids: string[]) => Promise<unknown>;
  /** Cờ đỏ đang chặn ký baseline (422 BASELINE_BLOCKED khi Accept ở S-9.5). */
  blockingFlags?: BlockingFlag[];
  /** Ký baseline ở S-9.5 chỉ Lead (UC-39); Analyst nộp cho Lead duyệt ở panel Kiểm tra (UC-38). BE chặn 403. */
  canSignOff?: boolean;
  onGoToStep?: (stepId: string) => void;
  /** Cờ đỏ/vàng mới của lượt này, nêu trong tin kèm chip xử lý. */
  newFlags?: GateNewFlag[];
  onFixFlag?: (flag: GateNewFlag) => void;
  onKeepFlag?: (flag: GateNewFlag, reason: string) => Promise<void>;
  /** "Tôi muốn sửa": đưa con trỏ vào ô chat — sửa là nhắn tin, không có form. */
  onWantEdit?: () => void;
  /** Lượt chạy vừa rồi có ghi được op nào vào Spine không (L11b). */
  wroteOps?: boolean;
  /**
   * FLF-337 "Chấp nhận, không hỏi lại phần này": các section bước vừa chạm (từ `summary[].section_id`) vào danh sách tự qua,
   * rồi Accept như thường. Vắng ⇒ không có mục này trong menu.
   */
  onAcceptSkipSections?: (sectionIds: string[]) => void;
  /** Mục step này nuôi mà chạy xong vẫn trống — accept cũng không đóng được cờ `section_empty` (L11b). */
  emptySections?: { section_id: string; title: string }[];
  onAction: (action: GateAction, note?: string) => void;
}

type GateT = ReturnType<typeof useTranslations<"workspace.gate">>;

/** Một câu cảnh báo khi lượt chạy không ghi gì / mục còn trống (L11b) — nói thẳng kèm lối ra. */
const warningSentence = (warnNoOps: boolean, emptySections: readonly { title: string }[], t: GateT): string | null => {
  const base = warnNoOps ? t("warnNoOps") : t("warnEmpty");
  if (emptySections.length > 0) {
    const titles = emptySections.map((s) => s.title).join(", ");
    return t("warnEmptySections", { base, titles });
  }
  return warnNoOps ? t("warnNoOpsHint", { base }) : null;
};

/**
 * Giả định tin cổng đã nói mà chưa được chốt trong Spine — `gate_ready` khôi phục sau reload vẫn mang những
 * giả định đã xác nhận/bỏ, không xác nhận lại chúng.
 *
 * Xuất ra vì duyệt có **hai lối**: chip trên thẻ này, và một tiếng "ừ" gõ ở ô chat. Hai lối phải xác nhận
 * đúng cùng một tập giả định, nên phép lọc chỉ được viết một lần.
 */
export const unsettledAssumptions = (
  spoken: AssumptionBrief[] | undefined,
  fromPayload: AssumptionBrief[] | undefined,
  settledIds: ReadonlySet<string> | undefined
): AssumptionBrief[] => (spoken ?? fromPayload ?? []).filter((a) => !settledIds?.has(a.id));

/**
 * Cổng chốt như một tin nhắn AI: lời AI, chip "Đúng rồi, đi tiếp" / "Tôi muốn sửa", menu ⋯ (Làm lại · Duyệt như hiện tại).
 * Dùng chung cho cả hai chế độ duyệt. Sửa = nhắn tin ở ô chat (revision), không có form ở đây.
 */
export default function GateCard({
  stepId,
  actions,
  regenerateUsed,
  regenerateLimit = REGENERATE_LIMIT,
  busy = false,
  message,
  phaseSummary,
  payload = null,
  spokenAssumptions,
  settledAssumptionIds,
  onConfirmAssumptions,
  blockingFlags,
  canSignOff = true,
  onGoToStep,
  newFlags,
  onFixFlag,
  onKeepFlag,
  onWantEdit,
  wroteOps = true,
  emptySections = [],
  onAcceptSkipSections,
  onAction,
}: GateCardProps) {
  const t = useTranslations("workspace.gate");
  const tHelpers = useTranslations("workspace.gateHelpers") as unknown as GateHelpersT;
  const locale = useLocale();
  const [asIs, setAsIs] = useState(false);
  const [note, setNote] = useState("");

  const summary = phaseSummary ?? payload?.summary ?? [];
  const text = (phaseSummary ? message : (message ?? payload?.message_vi))?.trim() || fallbackGateMessage(summary, payload?.no_change_reason, tHelpers, locale);
  // `gate_ready` khôi phục sau reload vẫn mang giả định đã xác nhận/bỏ trong Spine — không xác nhận lại chúng
  const assumptions = unsettledAssumptions(spokenAssumptions, payload?.new_assumptions, settledAssumptionIds);

  // Khoá mọi hành động từ cú bấm đầu tới khi lệnh đã gửi: lúc chờ xác nhận giả định (~1 s) `busy` của runner chưa bật,
  // bấm Duyệt lần hai gửi thêm một lượt gate + chạy giai đoạn ⇒ 409 và thanh "Lượt chạy bị gián đoạn". Ref chặn cả hai
  // cú bấm rơi vào cùng một lượt render; state để khoá nút trên màn hình.
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const act = async (action: GateAction, actionNote?: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      if ((action === "accept" || action === "accept_as_is") && assumptions.length > 0 && onConfirmAssumptions) {
        await onConfirmAssumptions(assumptions.map((a) => a.id));
      }
      if (actionNote === undefined) onAction(action);
      else onAction(action, actionNote);
    } finally {
      // Lệnh đã giao cho runner — từ đây `busy` của runner giữ khoá; lệnh lỗi thì thẻ dùng lại được
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const locked = busy || submitting;

  // AI không được gọi (bước chỉ chốt một field đã có từ bước trước): ghi 0 op là đúng, không phải lỗi — không cảnh báo
  const nothingToDo = payload?.calls_used === 0 && Boolean(payload.no_change_reason) && emptySections.length === 0;
  const warning = warningSentence(!wroteOps && !nothingToDo, emptySections, t);

  const regenerateLeft = regenerateUsed < regenerateLimit && actions.includes("regenerate");
  const signOffBlocked = stepId === SIGN_OFF_STEP && !canSignOff;
  const showAcceptAsIs = !signOffBlocked && (actions.includes("accept_as_is") || regenerateUsed >= regenerateLimit);
  // FLF-337: section bước này chạm — "không hỏi lại" chỉ có nghĩa khi bước có chạm ít nhất một section và được Accept
  const touchedSections = Array.from(new Set((payload?.summary ?? []).map((c) => c.section_id).filter((id): id is string => typeof id === "string" && id.length > 0)));
  const canSkipSections = Boolean(onAcceptSkipSections) && actions.includes("accept") && touchedSections.length > 0 && stepId !== SIGN_OFF_STEP;
  const menuItems = [
    {
      label: t("regenerate", { count: Math.max(0, regenerateLimit - regenerateUsed) }),
      disabled: locked || !regenerateLeft,
      onSelect: () => void act("regenerate"),
    },
    ...(showAcceptAsIs ? [{ label: t("acceptAsIs"), disabled: locked, onSelect: () => setAsIs((open) => !open) }] : []),
    ...(canSkipSections
      ? [
          {
            label: t("acceptSkipSections", { count: touchedSections.length }),
            disabled: locked,
            onSelect: () => {
              onAcceptSkipSections?.(touchedSections);
              void act("accept");
            },
          },
        ]
      : []),
  ];

  const submitAsIs = () => {
    if (note.trim().length === 0 || locked) return;
    void act("accept_as_is", note.trim());
    setNote("");
    setAsIs(false);
  };

  return (
    <div className="flex flex-col gap-3" aria-label={t("aria")}>
      <p className="text-heading leading-7 text-on-surface whitespace-pre-line">{text}</p>

      {warning && (
        <p role="status" className="bg-accent-gold-soft text-accent-gold-text rounded-card px-3.5 py-2.5 text-body leading-6">
          {warning}
        </p>
      )}

      <GateFlags
        blockingFlags={blockingFlags}
        onGoToStep={onGoToStep}
        newFlags={newFlags}
        onFixFlag={onFixFlag}
        onKeepFlag={onKeepFlag}
        locked={locked}
      />

      {payload?.table && <GateTable table={payload.table} defaultOpen={stepId === "S-1.1"} />}

      {asIs && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`gate-note-${stepId}`} className="text-body font-semibold text-on-surface-variant">
            {t("acceptAsIsLabel")}
          </label>
          <textarea
            id={`gate-note-${stepId}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 rounded-control bg-surface-container text-body outline-none resize-none focus:bg-surface-container-high"
          />
          <div className="self-end">
            <QuickReplyChip tone="primary" disabled={note.trim().length === 0 || locked} onClick={submitAsIs}>
              {t("confirmAcceptAsIs")}
            </QuickReplyChip>
          </div>
        </div>
      )}

      {signOffBlocked && (
        <p role="status" className="bg-surface-container rounded-card px-3.5 py-2.5 text-body leading-6 text-on-surface-muted">
          {t("leadOnly")}
        </p>
      )}

      <QuickReplyChips>
        {!signOffBlocked && (
          <QuickReplyChip tone="primary" busy={locked} disabled={!actions.includes("accept")} onClick={() => void act("accept")}>
            {/* FLF-248: Accept ở S-9.5 là ký baseline — nhãn chung "đi tiếp" làm người dùng đi tìm nút ký ở chat */}
            {stepId === SIGN_OFF_STEP ? t("signBaseline") : t("accept")}
          </QuickReplyChip>
        )}
        {actions.includes("revision") && (
          <QuickReplyChip tone="soft" disabled={locked} onClick={() => onWantEdit?.()}>
            {t("wantEdit")}
          </QuickReplyChip>
        )}
        <DropdownMenu
          items={menuItems}
          placement="top"
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label={t("more")}
              className="size-9 grid place-items-center rounded-control bg-surface-container text-on-surface-muted hover:bg-surface-container-high hover:text-on-surface cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Icon name="more-horizontal" size={18} />
            </button>
          )}
        />
      </QuickReplyChips>
    </div>
  );
}
