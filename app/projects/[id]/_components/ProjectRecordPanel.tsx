"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import Tabs from "@/components/ui/Tabs";
import type { Op } from "@/types/pipeline";
import type { Change, Spine } from "@/types/spine";
import BriefSummaryCard from "./BriefSummaryCard";
import { otherKindLabel, otherRequirementText } from "./brief-labels";
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
}: ProjectRecordPanelProps) {
  const t = useTranslations("workspace.projectRecord");
  const tLabel = useTranslations("workspace.briefLabels");
  const locale = useLocale();
  const openItems = spine.other_requirements;
  const pendingCount = pendingRecordCount(spine, inBriefPhase);
  const decisions = (spine.decisions ?? []).filter((d) => d.superseded_by === null);
  const [tab, setTab] = useState<RecordTab>(pendingCount > 0 ? "pending" : "agreed");
  const busy = saving || readOnly;
  // FLF-292: nguồn tài liệu của yêu cầu — tải lại khi Spine đổi (lượt Draft mới có thể ghi nguồn mới)
  const sources = useSources(projectId, spine.spine_version);

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        label={t("tabsLabel")}
        idBase="project-record"
        value={tab}
        onChange={setTab}
        className="self-stretch [&>button]:flex-1 [&>button]:justify-center [&>button]:px-1.5 [&>button]:gap-1 [&>button]:whitespace-nowrap [&>button]:text-body"
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
                <DecisionsPanel spine={spine} onSubmitOps={onSubmitOps} busy={busy} />
              </Block>
            ) : (
              <p className="px-1 text-body text-on-surface-variant">
                {t.rich("decisionsNone", { b: (chunks) => <span className="font-semibold text-on-surface">{chunks}</span> })}
              </p>
            )}
            <Block title={t("namesTitle")} hint={t("namesHint")}>
              <NamesGlossaryPanel spine={spine} onSubmitOps={onSubmitOps} busy={busy} />
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
            {openItems.length > 0 && (
              <Block title={t("risksTitle", { count: openItems.length })} hint={t("risksHint")}>
                <ul className="flex flex-col gap-1.5">
                  {openItems.map((item) => (
                    <li key={item.id} className="text-body leading-relaxed text-on-surface">
                      <span className="text-caption font-semibold text-on-surface-variant">{otherKindLabel(item.kind, tLabel)} · </span>
                      {otherRequirementText(item, locale)}
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
            {!inBriefPhase && spine.screens.length === 0 && openItems.length === 0 && (
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
