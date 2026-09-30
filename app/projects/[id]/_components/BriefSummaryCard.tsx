"use client";

import { useMemo, useState } from "react";
import type { Spine } from "@/types/spine";
import { SECTION_LABEL, briefVisionGoals, formFactorLabel, groupByTarget, isBriefCoreTopic, stakesLabel } from "./brief-labels";

interface BriefSummaryCardProps {
  spine: Pick<Spine, "project" | "addendum" | "assumptions" | "other_requirements">;
}

export { OTHER_KIND_LABEL, groupByTarget } from "./brief-labels";

/**
 * Thẻ tóm tắt Brief — thay `SummaryReviewCard` cũ (đọc `discoverySummaryData` map cứng, dựng lại từ nội
 * dung tin nhắn). Ở đây mọi thứ đọc **thẳng từ Spine**: `project{}` do B-0/B-1 ghi, `addendum[]` nhóm
 * theo section đích, `other_requirements[]` và số giả định còn treo.
 *
 * Mục trống nghĩa là bước tương ứng chưa ghi op — hiện rõ chỗ thiếu thay vì im lặng lấp đầy.
 */
/** Số mục tiêu hiện khi thu gọn — còn lại mở bằng "Xem đầy đủ". */
const GOALS_PREVIEW = 3;

export default function BriefSummaryCard({ spine }: BriefSummaryCardProps) {
  const groups = useMemo(() => groupByTarget(spine.addendum.filter((entry) => !isBriefCoreTopic(entry.topic))), [spine.addendum]);
  const [full, setFull] = useState(false);
  const { project } = spine;
  const { vision, goals: allGoals } = useMemo(() => briefVisionGoals(spine), [spine]);
  const goals = full ? allGoals : allGoals.slice(0, GOALS_PREVIEW);

  const chip = (text: string) => (
    <span key={text} className="text-[10.5px] font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
      {text}
    </span>
  );
  const missing = (label: string) => <p className="text-[11.5px] text-on-surface-muted italic">Chưa có {label}.</p>;
  const label = (text: string) => <h6 className="text-[11px] font-semibold text-on-surface-muted">{text}</h6>;

  // Rủi ro & câu hỏi mở nằm ở tab "Chờ bạn quyết" — đây chỉ là những gì đã thống nhất
  return (
    <div className="flex flex-col gap-2.5 text-on-surface">
      <div className="flex flex-wrap gap-1.5">
        {formFactorLabel(project.form_factor) && chip(formFactorLabel(project.form_factor) as string)}
        {project.stakes && chip(stakesLabel(project.stakes) as string)}
      </div>

      <section className="flex flex-col gap-0.5">
        {label("Tầm nhìn")}
        {vision ? (
          <p className={`text-[12px] leading-relaxed ${full ? "" : "line-clamp-3"}`}>{vision}</p>
        ) : (
          missing("tầm nhìn")
        )}
      </section>

      <section className="flex flex-col gap-0.5">
        {label(`Mục tiêu (${allGoals.length})`)}
        {allGoals.length > 0 ? (
          <ul className="list-disc pl-4 text-[12px] leading-relaxed space-y-0.5">
            {goals.map((goal) => (
              <li key={goal.id}>{goal.text}</li>
            ))}
          </ul>
        ) : (
          missing("mục tiêu")
        )}
      </section>

      {full && groups.length > 0 && (
        <section className="flex flex-col gap-1.5">
          {label("Ghi chú theo mục tài liệu")}
          {groups.map(([target, entries]) => (
            <div key={target} className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold text-on-surface-variant">{SECTION_LABEL[target] ?? "Mục khác"}</span>
              <ul className="list-disc pl-4 text-[11.5px] leading-relaxed space-y-0.5">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    {entry.content}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {(allGoals.length > GOALS_PREVIEW || groups.length > 0 || (vision?.length ?? 0) > 180) && (
        <button type="button" onClick={() => setFull((v) => !v)} className="self-start text-[11.5px] font-semibold text-primary hover:underline cursor-pointer">
          {full ? "Thu gọn" : "Xem đầy đủ"}
        </button>
      )}
    </div>
  );
}
