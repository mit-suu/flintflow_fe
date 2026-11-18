"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Spine } from "@/types/spine";
import type { RequirementSourceRef } from "@/types/sources";
import { briefVisionGoals, formFactorLabel, groupByTarget, isBriefCoreTopic, sectionLabel, stakesLabel } from "./brief-labels";
import SourceChip from "./SourceChip";

interface BriefSummaryCardProps {
  spine: Pick<Spine, "project" | "addendum" | "assumptions" | "other_requirements">;
  /**
   * FLF-443: nguồn tài liệu theo đường dẫn phần tử. Tầm nhìn / mục tiêu / ghi chú Brief không có chỗ riêng trong tài liệu
   * nên chip nguồn của chúng nằm ở đây (Hồ sơ). Không truyền ⇒ không có chip.
   */
  sources?: ReadonlyMap<string, RequirementSourceRef[]>;
}

export { groupByTarget } from "./brief-labels";

/**
 * Thẻ tóm tắt Brief — thay `SummaryReviewCard` cũ (đọc `discoverySummaryData` map cứng, dựng lại từ nội
 * dung tin nhắn). Ở đây mọi thứ đọc **thẳng từ Spine**: `project{}` do B-0/B-1 ghi, `addendum[]` nhóm
 * theo section đích, `other_requirements[]` và số giả định còn treo.
 *
 * Mục trống nghĩa là bước tương ứng chưa ghi op — hiện rõ chỗ thiếu thay vì im lặng lấp đầy.
 */
/** Số mục tiêu hiện khi thu gọn — còn lại mở bằng "Xem đầy đủ". */
const GOALS_PREVIEW = 3;

export default function BriefSummaryCard({ spine, sources }: BriefSummaryCardProps) {
  const t = useTranslations("workspace.brief.summary");
  const tLabel = useTranslations("workspace.briefLabels");
  const groups = useMemo(() => groupByTarget(spine.addendum.filter((entry) => !isBriefCoreTopic(entry.topic))), [spine.addendum]);
  const [full, setFull] = useState(false);
  const { project } = spine;
  const { vision, goals: allGoals } = useMemo(() => briefVisionGoals(spine), [spine]);
  const goals = full ? allGoals : allGoals.slice(0, GOALS_PREVIEW);
  /** Chip của đường dẫn đầu tiên có nguồn (tầm nhìn có thể nằm ở `project.vision` hoặc ở ghi chú lõi của Brief). */
  const sourceChip = (...paths: string[]) => {
    const refs = paths.map((path) => sources?.get(path)).find((r) => r && r.length > 0);
    return refs ? <SourceChip refs={refs} /> : null;
  };
  const visionEntry = spine.addendum.find((entry) => isBriefCoreTopic(entry.topic) && entry.content.trim() === vision);

  const chip = (text: string) => (
    // Chữ sẫm trên nền xám đậm hơn card một nấc: xám-nhạt-trên-xám-nhạt đọc ra một cục, không ra chữ
    <span key={text} className="text-caption font-bold text-on-surface-dark bg-surface-container-high px-2 py-0.5 rounded-full">
      {text}
    </span>
  );
  const missing = (text: string) => <p className="text-body text-on-surface-variant italic">{text}</p>;
  const label = (text: string) => <h6 className="text-caption font-semibold text-on-surface-variant">{text}</h6>;

  // Rủi ro & câu hỏi mở nằm ở tab "Chờ bạn quyết" — đây chỉ là những gì đã thống nhất
  return (
    <div className="flex flex-col gap-2.5 text-on-surface">
      <div className="flex flex-wrap gap-1.5">
        {formFactorLabel(project.form_factor, tLabel) && chip(formFactorLabel(project.form_factor, tLabel) as string)}
        {project.stakes && chip(stakesLabel(project.stakes, tLabel) as string)}
      </div>

      <section className="flex flex-col gap-0.5">
        {label(t("vision"))}
        {vision ? (
          <p className={`text-body leading-relaxed ${full ? "" : "line-clamp-3"}`}>
            {vision}
            {sourceChip("project.vision", ...(visionEntry ? [`addendum[id=${visionEntry.id}]`] : []))}
          </p>
        ) : (
          missing(t("missingVision"))
        )}
      </section>

      <section className="flex flex-col gap-0.5">
        <div className="flex items-baseline">
          {label(t("goalsCount", { count: allGoals.length }))}
          {sourceChip("project.goals")}
        </div>
        {allGoals.length > 0 ? (
          <ul className="list-disc pl-4 text-body leading-relaxed space-y-0.5">
            {goals.map((goal) => (
              <li key={goal.id}>
                {goal.text}
                {sourceChip(`addendum[id=${goal.id}]`)}
              </li>
            ))}
          </ul>
        ) : (
          missing(t("missingGoals"))
        )}
      </section>

      {full && groups.length > 0 && (
        <section className="flex flex-col gap-1.5">
          {label(t("notesBySection"))}
          {groups.map(([target, entries]) => (
            <div key={target} className="flex flex-col gap-0.5">
              <span className="text-caption font-semibold text-on-surface-variant">{sectionLabel(target, tLabel) ?? tLabel("otherSection")}</span>
              <ul className="list-disc pl-4 text-body leading-relaxed space-y-0.5">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    {entry.content}
                    {sourceChip(`addendum[id=${entry.id}]`)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {(allGoals.length > GOALS_PREVIEW || groups.length > 0 || (vision?.length ?? 0) > 180) && (
        <button type="button" onClick={() => setFull((v) => !v)} className="self-start text-body font-semibold text-primary hover:underline cursor-pointer">
          {full ? t("collapse") : t("expand")}
        </button>
      )}
    </div>
  );
}
