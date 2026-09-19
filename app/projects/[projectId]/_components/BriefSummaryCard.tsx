"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Addendum, Spine } from "@/types/spine";
import { sectionKeyOf } from "./AddendumTriagePanel";

interface BriefSummaryCardProps {
  spine: Pick<Spine, "project" | "addendum" | "assumptions" | "other_requirements">;
}

/*
 * Nhãn ở `workspace.brief.*`: section đích (bảng chung với `AddendumTriagePanel`), form factor, stakes, loại
 * yêu cầu khác. Giá trị lạ từ Spine thì hiện nguyên khoá thô.
 */
const FORM_FACTORS = ["web_app", "mobile_app", "desktop_app", "api_service", "cli", "embedded"] as const;
const STAKES = ["internal", "production", "regulated"] as const;
const OTHER_KINDS = ["risk", "assumption", "open_question", "technical_risk"] as const;

const oneOf = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value);

/** Nhóm addendum theo `target_section` — đúng cách chúng sẽ đi vào tài liệu. */
export const groupByTarget = (addendum: Addendum[]): [string, Addendum[]][] => {
  const groups = new Map<string, Addendum[]>();
  for (const entry of addendum) {
    const list = groups.get(entry.target_section);
    if (list) list.push(entry);
    else groups.set(entry.target_section, [entry]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
};

/**
 * Thẻ tóm tắt Brief — thay `SummaryReviewCard` cũ (đọc `discoverySummaryData` map cứng, dựng lại từ nội
 * dung tin nhắn). Ở đây mọi thứ đọc **thẳng từ Spine**: `project{}` do B-0/B-1 ghi, `addendum[]` nhóm
 * theo section đích, `other_requirements[]` và số giả định còn treo.
 *
 * Mục trống nghĩa là bước tương ứng chưa ghi op — hiện rõ chỗ thiếu thay vì im lặng lấp đầy.
 */
export default function BriefSummaryCard({ spine }: BriefSummaryCardProps) {
  const t = useTranslations("workspace.brief");
  const groups = useMemo(() => groupByTarget(spine.addendum), [spine.addendum]);
  const unconfirmed = spine.assumptions.filter((a) => a.status === "unconfirmed").length;
  const { project } = spine;

  const chip = (text: string) => (
    <span key={text} className="text-[10px] font-bold text-[#6B6862] bg-[#F5F4F1] px-1.5 py-0.5 rounded-full">
      {text}
    </span>
  );

  const missing = (label: string) => (
    <p className="text-[11px] text-[#B45309] italic">{t("missing", { label })}</p>
  );

  return (
    <div className="flex flex-col gap-3 text-[#191817]">
      <div className="flex flex-wrap gap-1.5">
        {project.form_factor &&
          chip(oneOf(FORM_FACTORS, project.form_factor) ? t(`formFactor.${project.form_factor}`) : project.form_factor)}
        {project.stakes && chip(oneOf(STAKES, project.stakes) ? t(`stakes.${project.stakes}`) : project.stakes)}
        {project.working_mode && chip(project.working_mode === "fast" ? t("modeFast") : t("modeCoaching"))}
        {unconfirmed > 0 && chip(t("unconfirmed", { count: unconfirmed }))}
      </div>

      <section className="flex flex-col gap-1">
        <h5 className="text-[11px] font-extrabold text-[#8A867E] uppercase tracking-wide">{t("vision")}</h5>
        {project.vision ? <p className="text-[12px]">{project.vision}</p> : missing(t("missingVision"))}
      </section>

      <section className="flex flex-col gap-1">
        <h5 className="text-[11px] font-extrabold text-[#8A867E] uppercase tracking-wide">{t("goals")}</h5>
        {project.goals.length > 0 ? (
          <ul className="list-disc pl-4 text-[12px] space-y-0.5">
            {project.goals.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
        ) : (
          missing(t("missingGoals"))
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <h5 className="text-[11px] font-extrabold text-[#8A867E] uppercase tracking-wide">{t("notesBySection")}</h5>
        {groups.length === 0
          ? missing(t("missingNotes"))
          : groups.map(([target, entries]) => {
              const sectionKey = sectionKeyOf(target);
              return (
              <div key={target} className="flex flex-col gap-0.5">
                <span className="text-[10.5px] font-bold text-[#6B6862]">{sectionKey ? t(`section.${sectionKey}`) : target}</span>
                <ul className="list-disc pl-4 text-[11.5px] space-y-0.5">
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <span className="font-bold">{entry.topic}: </span>
                      {entry.content}
                    </li>
                  ))}
                </ul>
              </div>
              );
            })}
      </section>

      {spine.other_requirements.length > 0 && (
        <section className="flex flex-col gap-1">
          <h5 className="text-[11px] font-extrabold text-[#8A867E] uppercase tracking-wide">{t("risks")}</h5>
          <ul className="list-disc pl-4 text-[11.5px] space-y-0.5">
            {spine.other_requirements.map((item) => (
              <li key={item.id}>
                <span className="font-bold">{oneOf(OTHER_KINDS, item.kind) ? t(`otherKind.${item.kind}`) : item.kind}: </span>
                {item.statement}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
