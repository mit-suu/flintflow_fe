"use client";

import { useMemo, useState } from "react";
import type { Addendum, Spine } from "@/types/spine";

interface BriefSummaryCardProps {
  spine: Pick<Spine, "project" | "addendum" | "assumptions" | "other_requirements">;
}

/** Nhãn tiếng Việt cho section đích của addendum — khớp mục của tài liệu, không phải khoá thô. */
const SECTION_LABEL: Record<string, string> = {
  "fixed:1": "Tổng quan sản phẩm",
  "fixed:2.1": "Actor",
  "fixed:3.1.2": "Mô tả màn",
  "fixed:4.2.2": "Độ tin cậy",
  "fixed:4.2.3": "Hiệu năng",
  "fixed:5.4": "Yêu cầu khác (để dành)",
};

const FORM_FACTOR_LABEL: Record<string, string> = {
  web_app: "Web",
  mobile_app: "Mobile",
  desktop_app: "Desktop",
  api_service: "API",
  cli: "CLI",
  embedded: "Nhúng",
};

const STAKES_LABEL: Record<string, string> = {
  internal: "Nội bộ",
  production: "Chạy thật",
  regulated: "Có quản lý ngành",
};

export const OTHER_KIND_LABEL: Record<string, string> = {
  risk: "Rủi ro",
  assumption: "Giả định",
  open_question: "Câu hỏi mở",
  technical_risk: "Rủi ro kỹ thuật",
};

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
/** Số mục tiêu hiện khi thu gọn — còn lại mở bằng "Xem đầy đủ". */
const GOALS_PREVIEW = 3;

export default function BriefSummaryCard({ spine }: BriefSummaryCardProps) {
  const groups = useMemo(() => groupByTarget(spine.addendum), [spine.addendum]);
  const [full, setFull] = useState(false);
  const { project } = spine;
  const goals = full ? project.goals : project.goals.slice(0, GOALS_PREVIEW);

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
        {project.form_factor && chip(FORM_FACTOR_LABEL[project.form_factor] ?? project.form_factor)}
        {project.stakes && chip(STAKES_LABEL[project.stakes] ?? project.stakes)}
      </div>

      <section className="flex flex-col gap-0.5">
        {label("Tầm nhìn")}
        {project.vision ? (
          <p className={`text-[12px] leading-relaxed ${full ? "" : "line-clamp-3"}`}>{project.vision}</p>
        ) : (
          missing("tầm nhìn")
        )}
      </section>

      <section className="flex flex-col gap-0.5">
        {label(`Mục tiêu (${project.goals.length})`)}
        {project.goals.length > 0 ? (
          <ul className="list-disc pl-4 text-[12px] leading-relaxed space-y-0.5">
            {goals.map((goal) => (
              <li key={goal}>{goal}</li>
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
              <span className="text-[11px] font-semibold text-on-surface-variant">{SECTION_LABEL[target] ?? target}</span>
              <ul className="list-disc pl-4 text-[11.5px] leading-relaxed space-y-0.5">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <span className="font-semibold">{entry.topic}: </span>
                    {entry.content}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {(project.goals.length > GOALS_PREVIEW || groups.length > 0 || (project.vision?.length ?? 0) > 180) && (
        <button type="button" onClick={() => setFull((v) => !v)} className="self-start text-[11.5px] font-semibold text-primary hover:underline cursor-pointer">
          {full ? "Thu gọn" : "Xem đầy đủ"}
        </button>
      )}
    </div>
  );
}
