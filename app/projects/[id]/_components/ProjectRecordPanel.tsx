"use client";

import { useState, type ReactNode } from "react";
import Tabs from "@/components/ui/Tabs";
import type { Op } from "@/types/pipeline";
import type { Change, Spine } from "@/types/spine";
import BriefSummaryCard, { OTHER_KIND_LABEL } from "./BriefSummaryCard";
import { otherRequirementText } from "./brief-labels";
import DecisionsPanel from "./DecisionsPanel";
import NamesGlossaryPanel from "./NamesGlossaryPanel";
import AssumptionSweepPanel from "./AssumptionSweepPanel";
import AddendumTriagePanel from "./AddendumTriagePanel";
import ScreenQueuePanel from "./ScreenQueuePanel";
import EditHistory from "./EditHistory";
import { pendingRecordCount } from "./project-record-pending";

type RecordTab = "agreed" | "pending" | "history";

interface ProjectRecordPanelProps {
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
  const openItems = spine.other_requirements;
  const pendingCount = pendingRecordCount(spine, inBriefPhase);
  const decisions = (spine.decisions ?? []).filter((d) => d.superseded_by === null);
  const [tab, setTab] = useState<RecordTab>(pendingCount > 0 ? "pending" : "agreed");
  const busy = saving || readOnly;

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        label="Hồ sơ dự án"
        idBase="project-record"
        value={tab}
        onChange={setTab}
        className="self-stretch [&>button]:flex-1 [&>button]:justify-center [&>button]:px-1.5 [&>button]:gap-1 [&>button]:whitespace-nowrap [&>button]:text-body"
        options={[
          { value: "agreed", label: "Đã thống nhất" },
          { value: "pending", label: "Chờ bạn quyết", ...(pendingCount > 0 ? { count: pendingCount } : {}) },
          { value: "history", label: "Lịch sử" },
        ]}
      />

      {readOnly && (
        <p className="px-1 text-body text-on-surface-variant">Bạn đang xem với vai trò Viewer — chỉ xem hồ sơ, không chốt hay sửa được.</p>
      )}

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
              <p className="px-1 text-body text-on-surface-variant">
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
                <Block title="Những điều tôi đang hiểu" hint="Điều AI tạm hiểu khi bạn chưa nói rõ. Xác nhận đúng hay sai.">
                  <AssumptionSweepPanel spine={spine} onSubmitOps={onSubmitOps} busy={busy} />
                </Block>
                <Block title="Ghi chú" hint="Chọn giữ, để dành cho phụ lục, hoặc bỏ từng ghi chú.">
                  <AddendumTriagePanel spine={spine} onSubmitOps={onSubmitOps} busy={busy} />
                </Block>
              </>
            )}
            {openItems.length > 0 && (
              <Block title={`Rủi ro & câu hỏi mở (${openItems.length})`} hint="Điều chưa ngã ngũ — trả lời trong chat khi AI hỏi tới.">
                <ul className="flex flex-col gap-1.5">
                  {openItems.map((item) => (
                    <li key={item.id} className="text-body leading-relaxed text-on-surface">
                      <span className="text-caption font-semibold text-on-surface-variant">{OTHER_KIND_LABEL[item.kind] ?? item.kind} · </span>
                      {otherRequirementText(item)}
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
              <p className="px-1 py-2 text-body text-on-surface-variant">Hiện chưa có gì chờ bạn quyết.</p>
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
