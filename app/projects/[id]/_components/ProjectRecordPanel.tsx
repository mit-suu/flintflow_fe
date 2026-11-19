"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import Tabs from "@/components/ui/Tabs";
import type { Op } from "@/types/pipeline";
import type { Change, Spine } from "@/types/spine";
import type { Flag } from "@/types/flags";
import type { PendingQueue } from "@/types/pending-queue";
import type { Locale } from "@/lib/i18n";
import BriefSummaryCard from "./BriefSummaryCard";
import Icon from "@/components/ui/Icon";
import { otherRequirementText } from "./brief-labels";
import DecisionsPanel from "./DecisionsPanel";
import NamesGlossaryPanel from "./NamesGlossaryPanel";
import AssumptionSweepPanel from "./AssumptionSweepPanel";
import AddendumTriagePanel from "./AddendumTriagePanel";
import ScreenQueuePanel from "./ScreenQueuePanel";
import EditHistory from "./EditHistory";
import TraceabilityMap from "./TraceabilityMap";
import SourceChip from "./SourceChip";
import type { RequirementSourceRef } from "@/types/sources";
import { buildItemView, type ItemView, type ResolveQueueT } from "./resolve-queue/resolve-queue-view";

type RecordTab = "agreed" | "pending" | "history" | "trace";

/** Việc của tab Chờ quyết: chỉ việc không phải cờ (cờ xem ở Kiểm & chốt). */
const RECORD_KINDS = new Set(["assumption", "brief_note", "screen"]);
const NO_EDITED_GROUPS: ReadonlySet<string> = new Set();
const EMPTY_SOURCES: ReadonlyMap<string, RequirementSourceRef[]> = new Map();

interface ProjectRecordPanelProps {
  projectId: string;
  spine: Spine;
  onSubmitOps: (ops: Op[]) => Promise<void> | void;
  onMarkPlaceholder: (screenId: string) => void;
  busy?: boolean;
  /** Viewer: chỉ xem — khoá mọi nút chốt/sửa (BE cũng chặn ghi với 403). */
  readOnly?: boolean;
  /** Đang ở pha Brief (B-*, S-1) — giả định & ghi chú Brief chỉ còn chờ quyết trong pha này. */
  inBriefPhase: boolean;
  history: Change[];
  historyLoading: boolean;
  onLoadHistory: () => void;
  /** Điền sẵn lệnh sửa (quyết định, tên, thuật ngữ) vào ô chat, bật Sửa tài liệu — không sửa tay trong panel. */
  onEditByChat?: (prefill: string) => void;
  /** Điền sẵn câu trả lời cho một câu hỏi mở vào ô chat (không bật Sửa tài liệu). */
  onAnswerInChat?: (prefill: string) => void;
  /**
   * FLF-443: hàng việc chờ quyết của BE. Có hàng ⇒ tab Chờ quyết chỉ xem, mỗi việc "Quyết trong chat". `null` (chưa tải /
   * Viewer) hoặc `queueError` ⇒ tab hiện lại các panel ghi cũ để không mất đường quyết.
   */
  queue?: PendingQueue | null;
  queueError?: string | null;
  flags?: readonly Flag[];
  /** Mở thẻ giải quyết của một việc ở vùng ô nhập. */
  onDecideInChat?: (key: string) => void;
  sectionName?: (sectionId: string) => string | undefined;
  /** Nguồn tài liệu theo đường dẫn phần tử (page tải một lần, dùng chung với chip trong tài liệu). */
  sources?: ReadonlyMap<string, RequirementSourceRef[]>;
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-card bg-surface-container-lowest px-3.5 py-3 flex flex-col gap-2">
      <div>
        <h5 className="text-body font-bold text-on-surface">{title}</h5>
        {hint && <p className="text-body text-on-surface-variant leading-relaxed">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * "Hồ sơ dự án" — thay panel "Công cụ" (8 phần không liên quan xếp chồng). Chia theo ý định của người dùng:
 * **Đã thống nhất** (tra cứu) · **Chờ bạn quyết** (chỉ xem; quyết ở thẻ trong chat, FLF-443) · **Lịch sử** sửa · **Truy vết**.
 */
export default function ProjectRecordPanel({
  projectId,
  spine,
  onSubmitOps,
  onMarkPlaceholder,
  busy: saving = false,
  readOnly = false,
  inBriefPhase,
  history,
  historyLoading,
  onLoadHistory,
  onEditByChat,
  onAnswerInChat,
  queue = null,
  queueError = null,
  flags = [],
  onDecideInChat,
  sectionName = () => undefined,
  sources: sourceMap = EMPTY_SOURCES,
}: ProjectRecordPanelProps) {
  const t = useTranslations("workspace.projectRecord");
  const tQueue = useTranslations("workspace.resolveQueue") as unknown as ResolveQueueT;
  const locale = useLocale() as Locale;
  const openQuestions = spine.other_requirements.filter((item) => item.kind === "open_question");
  // Hàng đợi chạy được ⇒ nơi quyết duy nhất là thẻ ở vùng ô nhập; tab chỉ liệt kê. Số đếm lấy từ hàng, không tự tính ở FE.
  const queueMode = queue !== null && !queueError;
  const queueViews: ItemView[] = queueMode
    ? queue.items
        .filter((item) => RECORD_KINDS.has(item.kind))
        .map((item) => buildItemView(item, { spine, flags, locale, t: tQueue, sectionName, editedGroups: NO_EDITED_GROUPS }))
        .filter((view): view is ItemView => view !== null)
    : [];
  const pendingCount = queueViews.length;
  const decisions = (spine.decisions ?? []).filter((d) => d.superseded_by === null);
  const [tab, setTab] = useState<RecordTab>(pendingCount > 0 ? "pending" : "agreed");
  const busy = saving || readOnly;

  return (
    <div className="@container flex flex-col gap-3">
      <Tabs
        label={t("tabsLabel")}
        idBase="project-record"
        value={tab}
        onChange={setTab}
        layout="grid"
        className="self-stretch grid-cols-2 @min-[34rem]:grid-cols-4 [&>button]:justify-center [&>button]:px-1.5 [&>button]:gap-1 [&>button]:whitespace-nowrap [&>button]:text-body"
        options={[
          { value: "agreed", label: t("tab.agreed") },
          { value: "pending", label: t("tab.pending"), ...(pendingCount > 0 ? { count: pendingCount } : {}) },
          { value: "history", label: t("tab.history") },
          { value: "trace", label: t("tab.trace") },
        ]}
      />

      {readOnly && (
        <p className="px-1 text-body text-on-surface-variant">{t("viewerNote")}</p>
      )}

      <div role="tabpanel" id="project-record-panel" aria-labelledby={`project-record-tab-${tab}`} className="flex flex-col gap-2.5">
        {tab === "agreed" && (
          <>
            <Block title={t("briefTitle")} hint={t("briefHint")}>
              <BriefSummaryCard spine={spine} sources={sourceMap} />
            </Block>
            {decisions.length > 0 ? (
              <Block title={t("decisionsTitle", { count: decisions.length })} hint={t("decisionsHint")}>
                <DecisionsPanel spine={spine} onEditByChat={readOnly ? undefined : onEditByChat} busy={busy} sources={sourceMap} />
              </Block>
            ) : (
              <p className="px-1 text-body text-on-surface-variant">
                {t.rich("decisionsNone", { b: (chunks) => <span className="font-semibold text-on-surface">{chunks}</span> })}
              </p>
            )}
            <Block title={t("namesTitle")} hint={t("namesHint")}>
              <NamesGlossaryPanel spine={spine} onEditByChat={readOnly ? undefined : onEditByChat} busy={busy} />
            </Block>
          </>
        )}

        {tab === "pending" && (
          <>
            {queueViews.length > 0 && (
              <Block title={t("queueTitle", { count: queueViews.length })} hint={t("queueHint")}>
                <ul className="flex flex-col gap-1.5">
                  {queueViews.map((view) => {
                    const refs = view.kind === "brief_note" ? sourceMap.get(`addendum[id=${view.entityId}]`) : undefined;
                    return (
                      <li key={view.key} className="rounded-inner bg-surface-container-low px-3 py-2.5 flex flex-col gap-1.5">
                        <span className="text-caption font-bold text-on-surface-variant">{view.kindLabel}</span>
                        <div className="text-body leading-relaxed text-on-surface">
                          {view.subject}
                          {refs && <SourceChip refs={refs} />}
                        </div>
                        {onDecideInChat && !readOnly && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onDecideInChat(view.key)}
                            className="self-end inline-flex items-center gap-1 px-2 py-0.5 rounded-control text-caption font-bold text-primary hover:bg-primary-soft cursor-pointer disabled:opacity-50"
                          >
                            {t("decideInChat")}
                            <Icon name="arrow-right" size={12} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Block>
            )}
            {queueError && <p className="px-1 text-body text-on-surface-variant">{t("queueFallback")}</p>}
            {!queueMode && inBriefPhase && (
              <>
                <Block title={t("assumptionsTitle")} hint={t("assumptionsHint")}>
                  <AssumptionSweepPanel spine={spine} onSubmitOps={onSubmitOps} busy={busy} />
                </Block>
                <Block title={t("notesTitle")} hint={t("notesHint")}>
                  <AddendumTriagePanel spine={spine} onSubmitOps={onSubmitOps} busy={busy} />
                </Block>
              </>
            )}
            {/* Chỉ câu hỏi mở: rủi ro / rủi ro kỹ thuật đã là nội dung mục Other Requirements của tài liệu, không lặp ở panel.
                Mỗi câu một thẻ, nút trả lời luôn ở góc phải dưới ⇒ thẳng hàng dù câu dài hay ngắn */}
            {openQuestions.length > 0 && (
              <Block title={t("openQuestionsTitle", { count: openQuestions.length })} hint={t("openQuestionsHint")}>
                <ul className="flex flex-col gap-1.5">
                  {openQuestions.map((item) => (
                    <li key={item.id} className="rounded-inner bg-surface-container-low px-3 py-2.5 flex flex-col gap-1.5">
                      <p className="text-body leading-relaxed text-on-surface">{otherRequirementText(item, locale)}</p>
                      {onAnswerInChat && !readOnly && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onAnswerInChat(t("answerInChatPrefill", { question: otherRequirementText(item, locale) }))}
                          className="self-end inline-flex items-center gap-1 px-2 py-0.5 rounded-control text-caption font-bold text-primary hover:bg-primary-soft cursor-pointer disabled:opacity-50"
                        >
                          {t("answerInChat")}
                          <Icon name="arrow-right" size={12} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Block>
            )}
            {!queueMode && spine.screens.length > 0 && (
              <Block title={t("screensTitle")} hint={t("screensHint")}>
                <ScreenQueuePanel spine={spine} onMarkPlaceholder={onMarkPlaceholder} busy={busy} />
              </Block>
            )}
            {(queueMode ? queueViews.length === 0 : !inBriefPhase && spine.screens.length === 0) && openQuestions.length === 0 && (
              <p className="px-1 py-2 text-body text-on-surface-variant">{t("nothingPending")}</p>
            )}
          </>
        )}


        {tab === "history" && (
          <Block title={t("historyTitle")} hint={t("historyHint")}>
            <EditHistory history={history} loading={historyLoading} onLoad={onLoadHistory} />
          </Block>
        )}

        {/* FLF-443: bản đồ truy vết dời từ Kiểm & chốt về Hồ sơ */}
        {tab === "trace" && (
          <Block title={t("tab.trace")} hint={t("traceHint")}>
            <TraceabilityMap projectId={projectId} spine={spine} />
          </Block>
        )}
      </div>
    </div>
  );
}
