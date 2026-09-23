"use client";

import { useState } from "react";
import Tabs from "@/components/ui/Tabs";
import { stepLabel } from "@/lib/constants/step-registry";
import { isFlagWaivable } from "@/types/flags";
import type { Flag } from "@/types/flags";
import Icon from "@/components/ui/Icon";
import { ACTION_INFO, flagGroupTitle, groupByAction, isSectionLevelRule, issueCounts, readableMessage, type ActionGroup } from "./flag-rules";

const WAIVE_REASON_MIN_LENGTH = 20;
/** Nhóm dài hơn mức này chỉ hiện chừng ấy dòng đầu + "Xem thêm". */
const PREVIEW_ROWS = 5;

interface WaiveModalProps {
  flag: Flag;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}

function WaiveModal({ flag, busy, error, onCancel, onSubmit }: WaiveModalProps) {
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length >= WAIVE_REASON_MIN_LENGTH && !busy;

  return (
    <div className="fixed inset-0 bg-black/35 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onCancel}>
      <div
        className="bg-surface-container-lowest rounded-dialog p-5 w-[420px] max-w-[90vw] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="font-extrabold text-[13.5px] text-on-surface">Bỏ qua vấn đề này?</h4>
        <p className="text-[11.5px] text-on-surface-variant leading-relaxed">{flag.message}</p>
        <label htmlFor="waive-reason" className="text-[11.5px] font-semibold text-on-surface">
          Lý do (tối thiểu {WAIVE_REASON_MIN_LENGTH} ký tự) — sẽ in kèm trong tài liệu
        </label>
        <textarea
          id="waive-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 rounded-control bg-surface-container text-[12px] outline-none resize-none focus:ring-2 focus:ring-primary/30"
          placeholder="Vì sao chấp nhận để nguyên vấn đề này?"
        />
        <span className="text-[10.5px] text-on-surface-subtle tabular-nums">
          {reason.trim().length}/{WAIVE_REASON_MIN_LENGTH}
        </span>
        {error && <div className="text-[11px] text-error">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-8 px-3.5 rounded-control text-[12px] font-bold text-on-surface-variant hover:bg-surface-container-high cursor-pointer disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(reason.trim())}
            className="h-8 px-3.5 rounded-control text-[12px] font-bold bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? "Đang lưu…" : "Bỏ qua vấn đề"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FlagsPanelProps {
  flags: Flag[];
  busy?: boolean;
  error?: string | null;
  /** Không truyền ⇒ không có nút bỏ qua (mode 1 v3: cờ chỉ đóng bằng change request). */
  onWaive?: (flagId: string, reason: string) => Promise<void>;
  onRecompute: () => void;
  onSelectStep?: (stepId: string) => void;
  /** Vẽ lại sơ đồ của cờ `diagram_stale` / `render_error` (BUG-17). */
  onRedraw?: (flag: Flag) => Promise<void> | void;
  /**
   * Xác nhận / bác bỏ một giả định ngay tại panel (BUG-13). Trước đây chỗ này chỉ có Waive, nên 27 giả
   * định chưa xác nhận ở S-9.1 không có đường xử lý nào ngoài "bỏ qua có lý do".
   */
  onAssumptionDecision?: (decision: { kind: "confirm" | "reject"; id: string }) => void;
  /**
   * Xác nhận cả loạt giả định trong một lượt ghi. S-9.1 quét ra vài chục giả định chưa xác nhận, mỗi cái
   * là một cờ đỏ chặn baseline — bấm từng cái là vài chục lượt ghi, và người dùng thật sẽ bỏ cuộc.
   */
  onConfirmAllAssumptions?: (ids: string[]) => void;
  /** Nhãn mục cho `section_id` (`§2.2.2 Actors`) — lấy từ tài liệu đang hiển thị. */
  sectionLabelOf?: (sectionId: string) => string | undefined;
  /** Cuộn khung tài liệu tới mục của cờ. */
  onShowSection?: (sectionId: string) => void;
  /** Chỉ hiện vấn đề của một mục (bấm chấm số trên tài liệu). */
  focusSectionId?: string | null;
  onClearFocus?: () => void;
  /** Số mục đã cũ (dữ liệu nguồn đổi sau khi chốt) — nhóm "Mục cần viết lại" đứng đầu, có nút viết lại tất cả. */
  outdatedCount?: number;
  onRewriteOutdated?: () => void;
  rewriting?: boolean;
  /** "Sửa trong chat" trên một vấn đề — bật chip Sửa tài liệu, điền sẵn tên mục. */
  onEditSection?: (sectionLabel: string) => void;
}

const isOpen = (flag: Flag): boolean => !flag.resolved_at && !flag.waived_by_user;

/**
 * BUG-34: cờ đỏ luôn đứng trước cờ vàng, rồi tới thứ tự step xử lý. Panel cũ xếp theo thứ tự BE trả về
 * nên cờ vàng che mất cờ đỏ — thứ chặn ký baseline lại nằm dưới thứ không chặn.
 */
export const sortFlags = (flags: readonly Flag[]): Flag[] =>
  [...flags].sort((a, b) => {
    if (a.level !== b.level) return a.level === "red" ? -1 : 1;
    if (a.remediation_step !== b.remediation_step) return a.remediation_step < b.remediation_step ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });

/** Cờ mà việc cần làm là vẽ lại sơ đồ, không phải sửa nội dung. */
export const isRedrawable = (flag: Flag): boolean => flag.rule_id === "diagram_stale" || flag.rule_id === "render_error";

/** Tab của panel: cờ đỏ (+ mục cần viết lại) chặn chốt bản · cờ vàng nên xem · đã bỏ qua. */
type IssueTab = "blocking" | "suggestions" | "waived";

const textButton = "text-[11px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:underline";
/** Hành động phụ: ẩn tới khi rê chuột hoặc focus vào dòng — mỗi dòng chỉ một hành động chính luôn hiện. */
const secondary = "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 transition-opacity";
const pillButton = "h-7 px-2.5 shrink-0 rounded-control text-[11px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

/**
 * Panel "Kiểm tra tài liệu": vấn đề gom theo **việc người dùng phải làm** (xác nhận · sửa · duyệt lại · vẽ lại ·
 * chạy tiếp), mỗi nhóm một câu giải thích + hành động chính. Luật `array_empty`/`dead_reference`/`render_error`
 * không bỏ qua được.
 */
export default function FlagsPanel({
  flags,
  busy = false,
  error,
  onWaive,
  onRecompute,
  onSelectStep,
  onRedraw,
  onAssumptionDecision,
  onConfirmAllAssumptions,
  sectionLabelOf,
  onShowSection,
  focusSectionId = null,
  onClearFocus,
  outdatedCount = 0,
  onRewriteOutdated,
  rewriting = false,
  onEditSection,
}: FlagsPanelProps) {
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [waiveError, setWaiveError] = useState<string | null>(null);
  const [redrawing, setRedrawing] = useState<string | null>(null);
  /** Nhóm đã bấm "Xem thêm". */
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  // Mở sẵn tab có việc: chỉ sang "Nên xem" khi không còn gì phải xử lý mà vẫn có gợi ý
  const [tab, setTab] = useState<IssueTab>(() =>
    !flags.some((f) => isOpen(f) && f.level === "red") && outdatedCount === 0 && flags.some((f) => isOpen(f) && f.level === "yellow")
      ? "suggestions"
      : "blocking"
  );

  const openFlags = sortFlags(flags.filter(isOpen)).filter((f) => !focusSectionId || f.section_id === focusSectionId);
  const redGroups = groupByAction(openFlags.filter((f) => f.level === "red"));
  const yellowGroups = groupByAction(openFlags.filter((f) => f.level === "yellow"));
  const waivedFlags = flags.filter((f) => f.waived_by_user);
  const waivingFlag = waivingId ? flags.find((f) => f.id === waivingId) : undefined;
  const showOutdated = !focusSectionId && outdatedCount > 0 && Boolean(onRewriteOutdated);
  const sectionName = (id: string) => sectionLabelOf?.(id) ?? id;
  const counts = issueCounts(openFlags, showOutdated ? outdatedCount : 0);

  const closeWaiveModal = () => {
    setWaiveError(null);
    setWaivingId(null);
  };

  // `onWaive` (từ `useFlags`) ném lỗi khi BE từ chối — bắt tại đây để không rơi vào unhandled
  // rejection và giữ modal mở để user sửa lại.
  const submitWaive = async (reason: string) => {
    if (!waivingFlag) return;
    setWaiveError(null);
    try {
      await onWaive?.(waivingFlag.id, reason);
      setWaivingId(null);
    } catch (err) {
      setWaiveError(err instanceof Error ? err.message : "Không bỏ qua được vấn đề này");
    }
  };

  const redraw = async (targets: Flag[]) => {
    if (!onRedraw) return;
    for (const flag of targets) {
      setRedrawing(flag.id);
      try {
        await onRedraw(flag);
      } finally {
        setRedrawing(null);
      }
    }
  };

  const sectionLink = (flag: Flag, className = "") =>
    onShowSection ? (
      <button type="button" onClick={() => onShowSection(flag.section_id)} className={`text-left hover:underline cursor-pointer ${className}`}>
        {sectionName(flag.section_id)}
      </button>
    ) : (
      <span className={className}>{sectionName(flag.section_id)}</span>
    );

  /** Mũi tên › ở cuối dòng: cả dòng bấm được để mở bước, nút này là đích bàn phím / trình đọc màn hình. */
  const chevron = (stepId: string) =>
    onSelectStep && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelectStep(stepId);
        }}
        aria-label={`Mở bước ${stepLabel(stepId)} (${stepId})`}
        className="shrink-0 w-6 h-6 grid place-items-center rounded-inner text-on-surface-subtle group-hover/row:text-primary cursor-pointer"
      >
        <Icon name="caret-right" size={14} />
      </button>
    );
  /** Cả dòng bấm được ⇒ mở bước sửa. */
  const rowOpen = (stepId: string) =>
    onSelectStep ? { onClick: () => onSelectStep(stepId), className: "cursor-pointer hover:bg-surface-container-low -mx-2 px-2 rounded-control" } : { className: "" };

  const waiveLink = (flag: Flag) =>
    onWaive &&
    isFlagWaivable(flag.rule_id) && (
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setWaiveError(null);
          setWaivingId(flag.id);
        }}
        className={`${textButton} ${secondary} text-on-surface-muted hover:text-on-surface`}
      >
        Bỏ qua
      </button>
    );

  /** Một dòng vấn đề, trình bày theo việc phải làm của nhóm. */
  const renderRow = (group: ActionGroup, flag: Flag) => {
    const message = readableMessage(flag.message, flag.section_id, sectionLabelOf?.(flag.section_id));
    switch (group.action) {
      case "confirm":
        return (
          <li key={flag.id} className="group/row py-2 flex items-start gap-3">
            <p className="flex-1 min-w-0 text-[12px] text-on-surface leading-relaxed">{message}</p>
            {onAssumptionDecision && flag.target_id ? (
              <span className="shrink-0 flex items-center gap-1.5 pt-0.5">
                <button type="button" disabled={busy} onClick={() => onAssumptionDecision({ kind: "confirm", id: flag.target_id as string })} className={`${pillButton} h-6 px-2 bg-success text-white hover:opacity-90`}>
                  Đúng
                </button>
                <button type="button" disabled={busy} onClick={() => onAssumptionDecision({ kind: "reject", id: flag.target_id as string })} className={`${pillButton} h-6 px-2 text-error hover:bg-error-container`}>
                  Sai
                </button>
              </span>
            ) : (
              waiveLink(flag)
            )}
          </li>
        );
      case "reaccept": {
        const open = rowOpen(flag.remediation_step);
        return (
          <li key={flag.id} onClick={open.onClick} className={`group/row py-1.5 flex items-center justify-between gap-2 ${open.className}`}>
            <div className="min-w-0 flex flex-col">
              <span className="text-[12.5px] text-on-surface truncate">{sectionName(flag.section_id)}</span>
              <span className="text-[11px] text-on-surface-muted flex items-center gap-2.5">
                {isSectionLevelRule(flag.rule_id) ? `Duyệt lại ở ${stepLabel(flag.remediation_step)}` : message}
                <span onClick={(e) => e.stopPropagation()}>{waiveLink(flag)}</span>
              </span>
            </div>
            {chevron(flag.remediation_step)}
          </li>
        );
      }
      case "redraw":
        return (
          <li key={flag.id} className="group/row py-1.5 flex items-center justify-between gap-3 text-[12px]">
            <div className="min-w-0 flex flex-col">
              <span className="text-on-surface leading-relaxed">{message}</span>
              {sectionLink(flag, "text-[11px] text-on-surface-muted")}
            </div>
            {onRedraw && (
              <button type="button" disabled={busy || redrawing === flag.id} onClick={() => void redraw([flag])} className={`${textButton} text-primary shrink-0`}>
                {redrawing === flag.id ? "Đang vẽ…" : "Vẽ lại"}
              </button>
            )}
          </li>
        );
      default: {
        const open = rowOpen(flag.remediation_step);
        return (
          <li key={flag.id} onClick={open.onClick} className={`group/row py-2 flex items-center justify-between gap-2 ${open.className}`}>
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="text-[12.5px] text-on-surface leading-relaxed">{message}</span>
              <span className="text-[11px] text-on-surface-muted flex flex-wrap items-center gap-x-2.5" onClick={(e) => e.stopPropagation()}>
                {sectionLink(flag)}
                {onEditSection && (
                  <button
                    type="button"
                    onClick={() => onEditSection(sectionName(flag.section_id))}
                    className={`${textButton} ${secondary} text-primary`}
                    title="Gõ lệnh sửa cho mục này trong chat"
                  >
                    Sửa trong chat
                  </button>
                )}
                {waiveLink(flag)}
              </span>
            </div>
            {chevron(flag.remediation_step)}
          </li>
        );
      }
    }
  };

  /** Hành động cho cả nhóm, đặt cạnh tiêu đề. */
  const groupAction = (group: ActionGroup) => {
    if (group.action === "confirm" && onConfirmAllAssumptions) {
      const ids = [...new Set(group.flags.map((f) => f.target_id).filter((id): id is string => Boolean(id)))];
      if (ids.length > 1)
        return (
          <button type="button" disabled={busy} onClick={() => onConfirmAllAssumptions(ids)} className={`${pillButton} bg-success text-white hover:opacity-90`}>
            Đúng hết
          </button>
        );
    }
    if (group.action === "redraw" && onRedraw && group.flags.length > 1)
      return (
        <button type="button" disabled={busy || redrawing !== null} onClick={() => void redraw(group.flags)} className={`${pillButton} bg-primary-soft text-primary-hover hover:bg-primary-fixed`}>
          {redrawing ? "Đang vẽ…" : "Vẽ lại tất cả"}
        </button>
      );
    return null;
  };

  /** Nhóm "Sẽ điền ở bước sau": gom theo bước — một bước nuôi nhiều mục, một mục có thể bị nhiều cờ "rỗng". */
  const renderStepRows = (group: ActionGroup) => {
    const byStep = new Map<string, Set<string>>();
    for (const flag of group.flags) {
      const sections = byStep.get(flag.remediation_step) ?? new Set<string>();
      sections.add(flag.section_id);
      byStep.set(flag.remediation_step, sections);
    }
    return [...byStep.entries()].map(([stepId, sections]) => (
      <li key={stepId} {...rowOpen(stepId)} className={`group/row py-1.5 flex items-center justify-between gap-2 ${rowOpen(stepId).className}`}>
        <div className="min-w-0 flex flex-col">
          <span className="text-[12.5px] text-on-surface">
            {stepLabel(stepId)} <span className="text-on-surface-muted">· {stepId}</span>
          </span>
          <span className="text-[11px] text-on-surface-muted truncate" title={[...sections].map(sectionName).join(", ")}>
            {[...sections].map(sectionName).join(", ")}
          </span>
        </div>
        {chevron(stepId)}
      </li>
    ));
  };

  const renderGroup = (group: ActionGroup, key: string) => {
    const info = ACTION_INFO[group.action];
    if (group.action === "run_step") {
      const steps = new Set(group.flags.map((f) => f.remediation_step)).size;
      const sections = new Set(group.flags.map((f) => f.section_id)).size;
      return (
        <section key={key} className="rounded-card bg-surface-container-lowest px-3.5 pt-3 pb-2 flex flex-col gap-1">
          <h5 className="text-[13px] font-bold text-on-surface">
            {info.title}{" "}
            <span className="font-semibold text-on-surface-muted tabular-nums">({sections === steps ? sections : `${sections} mục · ${steps} bước`})</span>
          </h5>
          <p className="text-[11.5px] text-on-surface-muted">{info.hint}</p>
          <ul className="flex flex-col">{renderStepRows(group)}</ul>
        </section>
      );
    }
    const expanded = showAll[key] || group.flags.length <= PREVIEW_ROWS;
    const rows = expanded ? group.flags : group.flags.slice(0, PREVIEW_ROWS);
    return (
      <section key={key} className="rounded-card bg-surface-container-lowest px-3.5 pt-3 pb-2 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h5 className="text-[13px] font-bold text-on-surface">
              {info.title} <span className="font-semibold text-on-surface-muted tabular-nums">({group.flags.length})</span>
            </h5>
            <p className="text-[11.5px] text-on-surface-muted">{info.hint}</p>
          </div>
          {groupAction(group)}
        </div>
        <ul className="flex flex-col">{rows.map((flag) => renderRow(group, flag))}</ul>
        {!expanded && (
          <button type="button" onClick={() => setShowAll((prev) => ({ ...prev, [key]: true }))} className={`${textButton} self-start text-primary py-1`}>
            Xem thêm {group.flags.length - PREVIEW_ROWS}
          </button>
        )}
      </section>
    );
  };

  const emptyNote = (text: string) => <p className="px-1 py-2 text-[12px] text-on-surface-muted">{text}</p>;

  return (
    <div className="flex flex-col gap-3" aria-label="Danh sách vấn đề">
      {focusSectionId && (
        <div className="flex items-center justify-between gap-2 rounded-control bg-primary-soft px-3 py-2 text-[12px] text-primary-hover">
          <span className="min-w-0 truncate">
            Vấn đề của <span className="font-bold">{sectionName(focusSectionId)}</span>
          </span>
          {onClearFocus && (
            <button type="button" onClick={onClearFocus} className="font-bold hover:underline cursor-pointer shrink-0">
              Xem tất cả
            </button>
          )}
        </div>
      )}

      <Tabs
        label="Loại vấn đề"
        idBase="doc-issues"
        value={tab}
        onChange={setTab}
        className="self-stretch [&>button]:flex-1 [&>button]:justify-center [&>button]:px-1.5 [&>button]:gap-1 [&>button]:whitespace-nowrap [&>button]:text-[12px]"
        options={[
          { value: "blocking", label: "Cần xử lý", count: counts.blocking },
          { value: "suggestions", label: "Nên xem", count: counts.suggestions },
          { value: "waived", label: "Đã bỏ qua", count: waivedFlags.length },
        ]}
      />

      {error && <div className="text-[11.5px] text-error">{error}</div>}

      <div role="tabpanel" id="doc-issues-panel" aria-labelledby={`doc-issues-tab-${tab}`} className="flex flex-col gap-2.5">
        {tab === "blocking" && (
          <>
            {showOutdated && (
              <section className="rounded-card bg-surface-container-lowest px-3.5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h5 className="text-[13px] font-bold text-on-surface">
                    Viết lại cho khớp <span className="font-semibold text-on-surface-muted tabular-nums">({outdatedCount})</span>
                  </h5>
                  <p className="text-[11.5px] text-on-surface-muted leading-relaxed">
                    Có mục viết dựa trên dữ liệu đã bị sửa sau đó. AI viết lại, bạn xem trước rồi mới áp dụng.
                  </p>
                </div>
                <button type="button" onClick={onRewriteOutdated} disabled={rewriting} className={`${pillButton} bg-primary text-on-primary hover:bg-primary-hover`}>
                  {rewriting ? "Đang kiểm tra…" : "Viết lại"}
                </button>
              </section>
            )}
            {redGroups.map((group) => renderGroup(group, `red:${group.action}`))}
            {redGroups.length === 0 &&
              !showOutdated &&
              emptyNote(focusSectionId ? "Mục này không còn vấn đề phải xử lý." : "Không còn vấn đề nào chặn việc chốt bản.")}
          </>
        )}

        {tab === "suggestions" &&
          (yellowGroups.length > 0 ? yellowGroups.map((group) => renderGroup(group, `yellow:${group.action}`)) : emptyNote("Không có gợi ý nào."))}

        {tab === "waived" &&
          (waivedFlags.length > 0 ? (
            <ul className="rounded-card bg-surface-container-lowest px-3.5 py-1.5">
              {waivedFlags.map((flag) => (
                <li key={flag.id} className="py-1.5 flex flex-col gap-0.5">
                  <span className="text-[12px] font-semibold text-on-surface">{flagGroupTitle(flag.rule_id) ?? flag.message}</span>
                  <span className="text-[11px] text-on-surface-muted">
                    {sectionName(flag.section_id)} · Lý do: {flag.waive_reason}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            emptyNote("Chưa bỏ qua vấn đề nào.")
          ))}
      </div>

      {/* BE tự kiểm lại sau mỗi lần ghi — nút này chỉ để dùng khi nghi số liệu lệch */}
      <button type="button" onClick={onRecompute} disabled={busy} className="self-start px-1 text-[11px] font-semibold text-on-surface-muted hover:text-on-surface hover:underline cursor-pointer disabled:opacity-50">
        Kiểm tra lại toàn bộ tài liệu
      </button>

      {waivingFlag && <WaiveModal flag={waivingFlag} busy={busy} error={waiveError} onCancel={closeWaiveModal} onSubmit={(reason) => void submitWaive(reason)} />}
    </div>
  );
}
