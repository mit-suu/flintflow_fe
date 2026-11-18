"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import Tabs from "@/components/ui/Tabs";
import type { Op } from "@/types/pipeline";
import type { Change, Spine } from "@/types/spine";
import BriefSummaryCard from "./BriefSummaryCard";
import Icon from "@/components/ui/Icon";
import { otherRequirementText } from "./brief-labels";
import DecisionsPanel from "./DecisionsPanel";
import NamesGlossaryPanel from "./NamesGlossaryPanel";
import AssumptionSweepPanel from "./AssumptionSweepPanel";
import AddendumTriagePanel from "./AddendumTriagePanel";
import ScreenQueuePanel from "./ScreenQueuePanel";
import EditHistory from "./EditHistory";
import { pendingRecordCount } from "./project-record-pending";
import SourcesPanel from "./SourcesPanel";
import { useSources } from "../hooks/useSources";

type RecordTab = "agreed" | "pending" | "sources" | "history";

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
 * **Đã thống nhất** (tra cứu) · **Chờ bạn quyết** (chỉ phần của giai đoạn hiện tại) · **Lịch sử** sửa.
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
}: ProjectRecordPanelProps) {
  const t = useTranslations("workspace.projectRecord");
  const locale = useLocale();
  const openQuestions = spine.other_requirements.filter((item) => item.kind === "open_question");
  const pendingCount = pendingRecordCount(spine, inBriefPhase);
  const decisions = (spine.decisions ?? []).filter((d) => d.superseded_by === null);
  const [tab, setTab] = useState<RecordTab>(pendingCount > 0 ? "pending" : "agreed");
  const busy = saving || readOnly;
  // FLF-292: nguồn tài liệu của yêu cầu — tải lại khi Spine đổi (lượt Draft mới có thể ghi nguồn mới)
  const sources = useSources(projectId, spine.spine_version);

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
          { value: "sources", label: t("tab.sources") },
          { value: "history", label: t("tab.history") },
        ]}
      />

      {readOnly && (
        <p className="px-1 text-body text-on-surface-variant">{t("viewerNote")}</p>
      )}

      <div role="tabpanel" id="project-record-panel" aria-labelledby={`project-record-tab-${tab}`} className="flex flex-col gap-2.5">
        {tab === "agreed" && (
          <>
            <Block title={t("briefTitle")} hint={t("briefHint")}>
              <BriefSummaryCard spine={spine} />
            </Block>
            {decisions.length > 0 ? (
              <Block title={t("decisionsTitle", { count: decisions.length })} hint={t("decisionsHint")}>
                <DecisionsPanel spine={spine} onEditByChat={readOnly ? undefined : onEditByChat} busy={busy} />
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
            {inBriefPhase && (
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
            {spine.screens.length > 0 && (
              <Block title={t("screensTitle")} hint={t("screensHint")}>
                <ScreenQueuePanel spine={spine} onMarkPlaceholder={onMarkPlaceholder} busy={busy} />
              </Block>
            )}
            {!inBriefPhase && spine.screens.length === 0 && openQuestions.length === 0 && (
              <p className="px-1 py-2 text-body text-on-surface-variant">{t("nothingPending")}</p>
            )}
          </>
        )}

        {tab === "sources" && <SourcesPanel spine={spine} sources={sources.sources} loading={sources.loading} error={sources.error} />}

        {tab === "history" && (
          <Block title={t("historyTitle")} hint={t("historyHint")}>
            <EditHistory history={history} loading={historyLoading} onLoad={onLoadHistory} />
          </Block>
        )}
      </div>
    </div>
  );
}
