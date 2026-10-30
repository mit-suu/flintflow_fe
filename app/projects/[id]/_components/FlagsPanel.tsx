"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Tabs from "@/components/ui/Tabs";
import { workspaceStepLabel } from "./phase-labels";
import { isFlagWaivable, isOpenFlag } from "@/types/flags";
import type { Flag } from "@/types/flags";
import Icon from "@/components/ui/Icon";
import { useMode1Labels } from "./mode1/i18n";
import { WAIVE_REASON_MIN_LENGTH, flagGroupTitle, groupByAction, isSectionLevelRule, issueCounts, readableMessage, type ActionGroup } from "./flag-rules";
import { userErrorMessage } from "@/lib/api/error-messages";
import { hookErrorText } from "@/lib/hook-errors";

/** Nhóm dài hơn mức này chỉ hiện chừng ấy dòng đầu + "Xem thêm". */
const PREVIEW_ROWS = 5;

interface WaiveModalProps {
  flag: Flag;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}

/**
 * Một modal, hai nghĩa (FLF-329, BR-04): cờ đỏ ⇒ "Giữ nguyên + lý do" — ghi lý do, cờ **vẫn chặn** chốt bản;
 * cờ vàng ⇒ bỏ qua như cũ. Chữ trên modal phải nói đúng điều sẽ xảy ra.
 */
function WaiveModal({ flag, busy, error, onCancel, onSubmit }: WaiveModalProps) {
  const t = useTranslations("workspace.flags");
  const { humanizeText } = useMode1Labels();
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length >= WAIVE_REASON_MIN_LENGTH && !busy;
  const keeping = flag.level === "red";

  return (
    <div className="fixed inset-0 bg-black/35 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onCancel}>
      <div
        className="bg-surface-container-lowest rounded-dialog p-5 w-[420px] max-w-[90vw] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="font-extrabold text-body text-on-surface">{keeping ? t("keepHeading") : t("waiveHeading")}</h4>
        <p className="text-body text-on-surface-variant leading-relaxed">{humanizeText(flag.message)}</p>
        {keeping && <p className="text-caption text-error leading-relaxed">{t("keepStillBlocks")}</p>}
        <label htmlFor="waive-reason" className="text-body font-semibold text-on-surface">
          {t("waiveReasonLabel", { min: WAIVE_REASON_MIN_LENGTH })}
        </label>
        <textarea
          id="waive-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 rounded-control bg-surface-container text-body outline-none resize-none focus:ring-2 focus:ring-primary/30"
          placeholder={keeping ? t("keepPlaceholder") : t("waivePlaceholder")}
        />
        <span className="text-caption text-on-surface-subtle tabular-nums">
          {reason.trim().length}/{WAIVE_REASON_MIN_LENGTH}
        </span>
        {error && <div className="text-caption text-error">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-8 px-3.5 rounded-control text-body font-bold text-on-surface-variant hover:bg-surface-container-high cursor-pointer disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(reason.trim())}
            className="h-8 px-3.5 rounded-control text-body font-bold bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? t("saving") : keeping ? t("keepSubmit") : t("waiveSubmit")}
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
  /** Không truyền ⇒ không có nút bỏ qua (mode 1 v3: cờ chỉ đóng bằng change request). Chỉ cờ vàng (FLF-329). */
  onWaive?: (flagId: string, reason: string) => Promise<void>;
  /** FLF-329 "Giữ nguyên + lý do" cho cờ đỏ — ghi lý do, cờ vẫn chặn. Không truyền ⇒ cờ đỏ không có nút. */
  onKeep?: (flagId: string, reason: string) => Promise<void>;
  /** Không truyền ⇒ không có nút kiểm lại (Viewer: kiểm lại là thao tác ghi). */
  onRecompute?: () => void;
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
  /** Số mục đã cũ (dữ liệu nguồn đổi sau khi chốt) — nhóm "Mục cần viết lại" đứng đầu, có nút viết lại tất cả. */
  outdatedCount?: number;
  onRewriteOutdated?: () => void;
  rewriting?: boolean;
  /** "Sửa trong chat" trên một vấn đề — bật chip Sửa tài liệu, điền sẵn tên mục. */
  onEditSection?: (sectionLabel: string) => void;
  /** FLF-278: "Nhờ AI soạn" trên cờ mục của mẫu còn trống — điền sẵn lệnh soạn nháp vào ô chat. */
  onDraftSection?: (sectionLabel: string) => void;
  /** Bước đã chốt: cờ "rỗng" của bước đã chốt là vấn đề cần xử lý, không phải "sẽ điền ở bước sau" (FLF-248). */
  acceptedSteps?: ReadonlySet<string>;
}

const isOpen = (flag: Flag): boolean => isOpenFlag(flag);

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

const textButton = "text-caption font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:underline";
/** Hành động phụ: ẩn tới khi rê chuột hoặc focus vào dòng — mỗi dòng chỉ một hành động chính luôn hiện. */
const secondary = "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 transition-opacity";
const pillButton = "h-7 px-2.5 shrink-0 rounded-control text-caption font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

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
  onKeep,
  onRecompute,
  onSelectStep,
  onRedraw,
  onAssumptionDecision,
  onConfirmAllAssumptions,
  sectionLabelOf,
  onShowSection,
  focusSectionId = null,
  outdatedCount = 0,
  onRewriteOutdated,
  rewriting = false,
  onEditSection,
  onDraftSection,
  acceptedSteps,
}: FlagsPanelProps) {
  const t = useTranslations("workspace.flags");
  const tRule = useTranslations("workspace.flagRules");
  const tHook = useTranslations("workspace.hookErrors");
  const { humanizeText, sectionName: fptSectionName } = useMode1Labels();
  const locale = useLocale();
  const stepLabel = (stepId: string) => workspaceStepLabel(stepId, locale);
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

  /**
   * Bấm chấm đỏ trên một mục **không lọc** danh sách — nó cuộn tới và làm nổi bật đúng dòng của mục đó.
   * Lọc đẩy panel vào một chế độ phải bấm "Xem tất cả" mới thoát, mà khi mục đó là mục duy nhất có vấn đề
   * thì vào/ra chế độ nhìn y hệt nhau nên không ai biết mình đang ở đâu. Nổi bật thì thấy ngay chỗ cần,
   * vẫn giữ nguyên bối cảnh các vấn đề khác.
   */
  const openFlags = sortFlags(flags.filter(isOpen));
  const redGroups = groupByAction(openFlags.filter((f) => f.level === "red"), acceptedSteps);
  const yellowGroups = groupByAction(openFlags.filter((f) => f.level === "yellow"), acceptedSteps);
  // FLF-329: cờ đỏ không waive được nữa — tab này chỉ còn cờ vàng đã bỏ qua
  const waivedFlags = flags.filter((f) => f.waived_by_user && f.level === "yellow");
  const waivingFlag = waivingId ? flags.find((f) => f.id === waivingId) : undefined;
  const showOutdated = outdatedCount > 0 && Boolean(onRewriteOutdated);
  // Tài liệu chưa tải xong ⇒ tên mục theo mẫu FPT, không hiện mã `fixed:3.1.2` (FLF-247)
  const sectionName = (id: string) => sectionLabelOf?.(id) ?? (fptSectionName(id) || id);
  const counts = issueCounts(openFlags, showOutdated ? outdatedCount : 0, acceptedSteps);

  const closeWaiveModal = () => {
    setWaiveError(null);
    setWaivingId(null);
  };

  // `onWaive` (từ `useFlags`) ném lỗi khi BE từ chối — bắt tại đây để không rơi vào unhandled
  // rejection và giữ modal mở để user sửa lại.
  const submitWaive = async (reason: string) => {
    if (!waivingFlag) return;
    setWaiveError(null);
    const keeping = waivingFlag.level === "red";
    try {
      await (keeping ? onKeep : onWaive)?.(waivingFlag.id, reason);
      setWaivingId(null);
    } catch (err) {
      setWaiveError(userErrorMessage(err, keeping ? t("keepFailed") : t("waiveFailed")));
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

  /**
   * Mũi tên › ở cuối dòng: cả dòng bấm được để mở bước, nút này là đích bàn phím / trình đọc màn hình. `label`: tên nút
   * trùng chữ người thấy trên dòng ("Duyệt lại ở …") để trình đọc màn hình / getByRole tìm được (E2E FAP #15).
   */
  const chevron = (stepId: string, label = t("openStepAria", { label: stepLabel(stepId), stepId })) =>
    onSelectStep && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelectStep(stepId);
        }}
        aria-label={label}
        className="shrink-0 w-6 h-6 grid place-items-center rounded-inner text-on-surface-subtle group-hover/row:text-primary cursor-pointer"
      >
        <Icon name="caret-right" size={14} />
      </button>
    );
  /** Cả dòng bấm được ⇒ mở bước sửa. */
  const rowOpen = (stepId: string) =>
    onSelectStep ? { onClick: () => onSelectStep(stepId), className: "cursor-pointer hover:bg-surface-container-low -mx-2 px-2 rounded-control" } : { className: "" };

  /**
   * Dòng của mục vừa bấm chấm đỏ: nền nổi bật + `data-focus-row` để cuộn tới. Không dùng viền/ring
   * (luật phẳng của repo) — nền `primary-soft` đã đủ tách khỏi nền trắng của card.
   */
  const focusClass = (flag: Flag) => (flag.section_id === focusSectionId ? "bg-primary-soft -mx-2 px-2 rounded-control" : "");

  // Dòng được làm nổi bật có thể nằm dưới tầm nhìn (danh sách dài) ⇒ cuộn tới, nếu không thì nổi bật vô nghĩa
  useEffect(() => {
    if (!focusSectionId) return;
    // `?.` trên chính hàm: jsdom (và trình duyệt cũ) không có `scrollIntoView`, thiếu nó thì chỉ mất
    // phần cuộn chứ không được phép làm hỏng panel
    document.querySelector("[data-focus-row]")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [focusSectionId, tab]);

  /**
   * BR-04: cờ **đỏ** không waive được — chọn "giữ nguyên kèm lý do" chỉ ghi lại lý do, cờ vẫn chặn chốt
   * bản. Nên nhãn phải nói thẳng điều đó; để nguyên chữ "Bỏ qua" là hứa một lối thoát không có thật,
   * người dùng bấm xong vẫn không chốt được mà không hiểu vì sao.
   */
  const waiveLink = (flag: Flag) =>
    (flag.level === "red" ? onKeep : onWaive) &&
    isFlagWaivable(flag.rule_id) && (
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setWaiveError(null);
          setWaivingId(flag.id);
        }}
        title={flag.level === "red" ? t("keepTitle") : undefined}
        className={`${textButton} ${secondary} text-on-surface-muted hover:text-on-surface`}
      >
        {flag.level === "red" ? (flag.kept_reason ? t("keptEdit") : t("keepBlocking")) : t("waive")}
      </button>
    );

  /** Lý do giữ nguyên đã ghi (FLF-329) — hiện ngay dưới dòng để người duyệt đọc được mà không mở modal. */
  const keptNote = (flag: Flag) =>
    flag.level === "red" && flag.kept_reason ? (
      <span className="text-caption text-on-surface-muted italic">{t("keptReason", { reason: flag.kept_reason })}</span>
    ) : null;

  /** Một dòng vấn đề, trình bày theo việc phải làm của nhóm. */
  const renderRow = (group: ActionGroup, flag: Flag) => {
    const message = readableMessage(flag.message, flag.section_id, sectionLabelOf?.(flag.section_id));
    switch (group.action) {
      case "confirm":
        return (
          <li key={flag.id} className="group/row py-2 flex items-start gap-3">
            <p className="flex-1 min-w-0 text-body text-on-surface leading-relaxed">{message}</p>
            {onAssumptionDecision && flag.target_id ? (
              <span className="shrink-0 flex items-center gap-1.5 pt-0.5">
                <button type="button" disabled={busy} onClick={() => onAssumptionDecision({ kind: "confirm", id: flag.target_id as string })} className={`${pillButton} h-6 px-2 bg-success text-white hover:opacity-90`}>
                  {t("right")}
                </button>
                <button type="button" disabled={busy} onClick={() => onAssumptionDecision({ kind: "reject", id: flag.target_id as string })} className={`${pillButton} h-6 px-2 text-error hover:bg-error-container`}>
                  {t("wrong")}
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
          <li
            key={flag.id}
            onClick={open.onClick}
            data-focus-row={flag.section_id === focusSectionId || undefined}
            className={`group/row py-1.5 flex items-center justify-between gap-2 ${open.className} ${focusClass(flag)}`}
          >
            <div className="min-w-0 flex flex-col">
              <span className="text-body text-on-surface truncate">{sectionName(flag.section_id)}</span>
              <span className="text-caption text-on-surface-muted flex items-center gap-2.5">
                {/* Nói việc phải làm, không chỉ nói chỗ phải tới — bấm vào dòng này là mở đúng bước đó */}
                {isSectionLevelRule(flag.rule_id) ? t("reacceptHint", { label: stepLabel(flag.remediation_step) }) : message}
                <span onClick={(e) => e.stopPropagation()}>{waiveLink(flag)}</span>
              </span>
            </div>
            {chevron(flag.remediation_step, isSectionLevelRule(flag.rule_id) ? t("reacceptAt", { label: stepLabel(flag.remediation_step) }) : undefined)}
          </li>
        );
      }
      case "redraw":
        return (
          <li key={flag.id} className="group/row py-1.5 flex items-center justify-between gap-3 text-body">
            <div className="min-w-0 flex flex-col">
              <span className="text-on-surface leading-relaxed">{message}</span>
              {sectionLink(flag, "text-caption text-on-surface-muted")}
            </div>
            {onRedraw && (
              <button type="button" disabled={busy || redrawing === flag.id} onClick={() => void redraw([flag])} className={`${textButton} text-primary shrink-0`}>
                {redrawing === flag.id ? t("redrawing") : t("redraw")}
              </button>
            )}
          </li>
        );
      default: {
        const open = rowOpen(flag.remediation_step);
        return (
          <li key={flag.id} onClick={open.onClick} className={`group/row py-2 flex items-center justify-between gap-2 ${open.className}`}>
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="text-body text-on-surface leading-relaxed">{message}</span>
              <span className="text-caption text-on-surface-muted flex flex-wrap items-center gap-x-2.5" onClick={(e) => e.stopPropagation()}>
                {sectionLink(flag)}
                {onEditSection && (
                  <button
                    type="button"
                    onClick={() => onEditSection(sectionName(flag.section_id))}
                    className={`${textButton} ${secondary} text-primary`}
                    title={t("editInChatTitle")}
                  >
                    {t("editInChat")}
                  </button>
                )}
                {onDraftSection && flag.rule_id === "template_section_empty" && (
                  <button
                    type="button"
                    onClick={() => onDraftSection(sectionName(flag.section_id))}
                    className={`${textButton} ${secondary} text-primary`}
                    title={t("draftInChatTitle")}
                  >
                    {t("draftInChat")}
                  </button>
                )}
                {waiveLink(flag)}
              </span>
              {keptNote(flag)}
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
            {t("allRight")}
          </button>
        );
    }
    if (group.action === "redraw" && onRedraw && group.flags.length > 1)
      return (
        <button type="button" disabled={busy || redrawing !== null} onClick={() => void redraw(group.flags)} className={`${pillButton} bg-primary-soft text-primary-hover hover:bg-primary-fixed`}>
          {redrawing ? t("redrawing") : t("redrawAll")}
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
          <span className="text-body text-on-surface">
            {stepLabel(stepId)}
          </span>
          <span className="text-caption text-on-surface-muted truncate" title={[...sections].map(sectionName).join(", ")}>
            {[...sections].map(sectionName).join(", ")}
          </span>
        </div>
        {chevron(stepId)}
      </li>
    ));
  };

  const renderGroup = (group: ActionGroup, key: string) => {
    const info = { title: t(`action.${group.action}.title`), hint: t(`action.${group.action}.hint`) };
    if (group.action === "run_step") {
      const steps = new Set(group.flags.map((f) => f.remediation_step)).size;
      const sections = new Set(group.flags.map((f) => f.section_id)).size;
      return (
        <section key={key} className="rounded-card bg-surface-container-lowest px-3.5 pt-3 pb-2 flex flex-col gap-1">
          <h5 className="text-body font-bold text-on-surface">
            {info.title}{" "}
            <span className="font-semibold text-on-surface-muted tabular-nums">({sections === steps ? sections : t("sectionsSteps", { sections, steps })})</span>
          </h5>
          <p className="text-body text-on-surface-muted">{info.hint}</p>
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
            <h5 className="text-body font-bold text-on-surface">
              {info.title} <span className="font-semibold text-on-surface-muted tabular-nums">({group.flags.length})</span>
            </h5>
            <p className="text-body text-on-surface-muted">{info.hint}</p>
          </div>
          {groupAction(group)}
        </div>
        <ul className="flex flex-col">{rows.map((flag) => renderRow(group, flag))}</ul>
        {!expanded && (
          <button type="button" onClick={() => setShowAll((prev) => ({ ...prev, [key]: true }))} className={`${textButton} self-start text-primary py-1`}>
            {t("showMore", { count: group.flags.length - PREVIEW_ROWS })}
          </button>
        )}
      </section>
    );
  };

  const emptyNote = (text: string) => <p className="px-1 py-2 text-body text-on-surface-muted">{text}</p>;

  return (
    <div className="flex flex-col gap-3" aria-label={t("listAria")}>
      <Tabs
        label={t("tabsLabel")}
        idBase="doc-issues"
        value={tab}
        onChange={setTab}
        className="self-stretch [&>button]:flex-1 [&>button]:justify-center [&>button]:px-1.5 [&>button]:gap-1 [&>button]:whitespace-nowrap [&>button]:text-body"
        options={[
          { value: "blocking", label: t("tab.blocking"), count: counts.blocking },
          { value: "suggestions", label: t("tab.suggestions"), count: counts.suggestions },
          { value: "waived", label: t("tab.waived"), count: waivedFlags.length },
        ]}
      />

      {error && <div className="text-body text-error">{hookErrorText(error, tHook)}</div>}

      <div role="tabpanel" id="doc-issues-panel" aria-labelledby={`doc-issues-tab-${tab}`} className="flex flex-col gap-2.5">
        {tab === "blocking" && (
          <>
            {showOutdated && (
              <section className="rounded-card bg-surface-container-lowest px-3.5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h5 className="text-body font-bold text-on-surface">
                    {t("rewriteTitle")} <span className="font-semibold text-on-surface-muted tabular-nums">({outdatedCount})</span>
                  </h5>
                  <p className="text-body text-on-surface-muted leading-relaxed">
                    {t("rewriteHint")}
                  </p>
                </div>
                <button type="button" onClick={onRewriteOutdated} disabled={rewriting} className={`${pillButton} bg-primary text-on-primary hover:bg-primary-hover`}>
                  {rewriting ? t("rewriteChecking") : t("rewrite")}
                </button>
              </section>
            )}
            {redGroups.map((group) => renderGroup(group, `red:${group.action}`))}
            {redGroups.length === 0 &&
              !showOutdated &&
              emptyNote(t("noBlocking"))}
          </>
        )}

        {tab === "suggestions" &&
          (yellowGroups.length > 0 ? yellowGroups.map((group) => renderGroup(group, `yellow:${group.action}`)) : emptyNote(t("noSuggestions")))}

        {tab === "waived" &&
          (waivedFlags.length > 0 ? (
            <ul className="rounded-card bg-surface-container-lowest px-3.5 py-1.5">
              {waivedFlags.map((flag) => (
                <li key={flag.id} className="py-1.5 flex flex-col gap-0.5">
                  <span className="text-body font-semibold text-on-surface">{flagGroupTitle(flag.rule_id, tRule) ?? humanizeText(flag.message)}</span>
                  <span className="text-caption text-on-surface-muted">
                    {t("waivedReason", { section: sectionName(flag.section_id), reason: flag.waive_reason ?? "" })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            emptyNote(t("noWaived"))
          ))}
      </div>

      {/* BE tự kiểm lại sau mỗi lần ghi — nút này chỉ để dùng khi nghi số liệu lệch.
          Chạy việc thật (tính lại cờ) ⇒ trông phải ra một nút, không phải dòng chú thích. */}
      {onRecompute && (
        <button
          type="button"
          onClick={onRecompute}
          disabled={busy}
          className="self-start h-8 px-2.5 rounded-control text-body font-semibold text-on-surface-muted hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("recompute")}
        </button>
      )}

      {waivingFlag && <WaiveModal flag={waivingFlag} busy={busy} error={waiveError} onCancel={closeWaiveModal} onSubmit={(reason) => void submitWaive(reason)} />}
    </div>
  );
}
