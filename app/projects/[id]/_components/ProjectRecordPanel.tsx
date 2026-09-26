"use client";

import { useState, type ReactNode } from "react";
import Tabs from "@/components/ui/Tabs";
import type { Op } from "@/types/pipeline";
import type { Change, Spine } from "@/types/spine";
import BriefSummaryCard, { OTHER_KIND_LABEL } from "./BriefSummaryCard";
import DecisionsPanel from "./DecisionsPanel";
import NamesGlossaryPanel from "./NamesGlossaryPanel";
import AssumptionSweepPanel from "./AssumptionSweepPanel";
import AddendumTriagePanel from "./AddendumTriagePanel";
import ScreenQueuePanel from "./ScreenQueuePanel";
import EditHistory from "./EditHistory";

type RecordTab = "agreed" | "pending" | "history";

interface ProjectRecordPanelProps {
  spine: Spine;
  onSubmitOps: (ops: Op[]) => Promise<void> | void;
  onMarkPlaceholder: (screenId: string) => void;
  busy?: boolean;
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
        <h5 className="text-[13px] font-bold text-on-surface">{title}</h5>
        {hint && <p className="text-[11.5px] text-on-surface-muted leading-relaxed">{hint}</p>}
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
  spine,
  onSubmitOps,
  onMarkPlaceholder,
  busy = false,
  inBriefPhase,
  history,
  historyLoading,
  onLoadHistory,
}: ProjectRecordPanelProps) {
  const unconfirmed = inBriefPhase ? spine.assumptions.filter((a) => a.status === "unconfirmed").length : 0;
  const briefNotes = inBriefPhase ? spine.addendum.length : 0;
  const screensQueued = spine.progress.current_phase === "S-5" ? spine.screens.filter((s) => s.detail_status === "pending").length : 0;
  const openItems = spine.other_requirements;
  const pendingCount = unconfirmed + briefNotes + screensQueued + openItems.length;
  const decisions = (spine.decisions ?? []).filter((d) => d.superseded_by === null);
  const [tab, setTab] = useState<RecordTab>(pendingCount > 0 ? "pending" : "agreed");

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        label="Hồ sơ dự án"
        idBase="project-record"
        value={tab}
        onChange={setTab}
        className="self-stretch [&>button]:flex-1 [&>button]:justify-center [&>button]:px-1.5 [&>button]:gap-1 [&>button]:whitespace-nowrap [&>button]:text-[12px]"
        options={[
          { value: "agreed", label: "Đã thống nhất" },
          { value: "pending", label: "Chờ bạn quyết", ...(pendingCount > 0 ? { count: pendingCount } : {}) },
          { value: "history", label: "Lịch sử" },
        ]}
      />

      <div role="tabpanel" id="project-record-panel" aria-labelledby={`project-record-tab-${tab}`} className="flex flex-col gap-2.5">
        {tab === "agreed" && (
          <>
            <Block title="Tóm tắt Brief" hint="Ý tưởng sản phẩm đã chốt ở giai đoạn Brief.">
              <BriefSummaryCard spine={spine} />
            </Block>
            {decisions.length > 0 ? (
              <Block title={`Quyết định đã chốt (${decisions.length})`} hint="AI dựa vào đây để không hỏi lại điều bạn đã nói.">
                <DecisionsPanel spine={spine} onSubmitOps={onSubmitOps} busy={busy} />
              </Block>
            ) : (
              <p className="px-1 text-[12px] text-on-surface-muted">
                <span className="font-semibold text-on-surface">Quyết định đã chốt</span> · chưa có
              </p>
            )}
            <Block title="Tên & thuật ngữ" hint="Tên chuẩn dùng thống nhất trong toàn bộ tài liệu.">
              <NamesGlossaryPanel spine={spine} onSubmitOps={onSubmitOps} busy={busy} />
            </Block>
          </>
        )}

        {tab === "pending" && (
          <>
            {inBriefPhase && (
              <>
                <Block title="Giả định cần xác nhận" hint="AI tự giả định khi Brief còn thiếu. Xác nhận đúng hay sai.">
                  <AssumptionSweepPanel spine={spine} onSubmitOps={onSubmitOps} busy={busy} />
                </Block>
                <Block title="Ghi chú Brief" hint="Chọn giữ, để dành cho phụ lục, hoặc bỏ từng ghi chú.">
                  <AddendumTriagePanel spine={spine} onSubmitOps={onSubmitOps} busy={busy} />
                </Block>
              </>
            )}
            {openItems.length > 0 && (
              <Block title={`Rủi ro & câu hỏi mở (${openItems.length})`} hint="Điều chưa ngã ngũ — trả lời trong chat khi AI hỏi tới.">
                <ul className="flex flex-col gap-1.5">
                  {openItems.map((item) => (
                    <li key={item.id} className="text-[12px] leading-relaxed text-on-surface">
                      <span className="text-[11px] font-semibold text-on-surface-muted">{OTHER_KIND_LABEL[item.kind] ?? item.kind} · </span>
                      {item.statement}
                    </li>
                  ))}
                </ul>
              </Block>
            )}
            {spine.screens.length > 0 && (
              <Block title="Màn hình sẽ đặc tả" hint="Thứ tự các màn AI đặc tả chi tiết. Để lại màn chưa cần làm ở vòng này.">
                <ScreenQueuePanel spine={spine} onMarkPlaceholder={onMarkPlaceholder} busy={busy} />
              </Block>
            )}
            {!inBriefPhase && spine.screens.length === 0 && openItems.length === 0 && (
              <p className="px-1 py-2 text-[12px] text-on-surface-muted">Hiện chưa có gì chờ bạn quyết.</p>
            )}
          </>
        )}

        {tab === "history" && (
          <Block title="Lịch sử sửa" hint="20 thay đổi gần nhất, mới nhất ở trên.">
            <EditHistory history={history} loading={historyLoading} onLoad={onLoadHistory} />
          </Block>
        )}
      </div>
    </div>
  );
}
