"use client";

import { useMemo } from "react";
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

const OTHER_KIND_LABEL: Record<string, string> = {
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
export default function BriefSummaryCard({ spine }: BriefSummaryCardProps) {
  const groups = useMemo(() => groupByTarget(spine.addendum), [spine.addendum]);
  const unconfirmed = spine.assumptions.filter((a) => a.status === "unconfirmed").length;
  const { project } = spine;

  const chip = (text: string) => (
    <span key={text} className="text-[10px] font-bold text-[#6B6862] bg-[#F5F4F1] px-1.5 py-0.5 rounded-full">
      {text}
    </span>
  );

  const missing = (label: string) => (
    <p className="text-[11px] text-[#B45309] italic">Chưa có {label} — quay lại bước tương ứng để ghi.</p>
  );

  return (
    <div className="flex flex-col gap-3 text-[#191817]">
      <div className="flex flex-wrap gap-1.5">
        {project.form_factor && chip(FORM_FACTOR_LABEL[project.form_factor] ?? project.form_factor)}
        {project.stakes && chip(STAKES_LABEL[project.stakes] ?? project.stakes)}
        {project.working_mode && chip(project.working_mode === "fast" ? "Chế độ nhanh" : "Chế độ kèm cặp")}
        {unconfirmed > 0 && chip(`${unconfirmed} giả định chờ xác nhận`)}
      </div>

      <section className="flex flex-col gap-1">
        <h5 className="text-[11px] font-extrabold text-[#8A867E] uppercase tracking-wide">Tầm nhìn</h5>
        {project.vision ? <p className="text-[12px]">{project.vision}</p> : missing("tầm nhìn (B-1.1)")}
      </section>

      <section className="flex flex-col gap-1">
        <h5 className="text-[11px] font-extrabold text-[#8A867E] uppercase tracking-wide">Mục tiêu</h5>
        {project.goals.length > 0 ? (
          <ul className="list-disc pl-4 text-[12px] space-y-0.5">
            {project.goals.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
        ) : (
          missing("mục tiêu (B-1.1)")
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <h5 className="text-[11px] font-extrabold text-[#8A867E] uppercase tracking-wide">Ghi chú theo mục tài liệu</h5>
        {groups.length === 0
          ? missing("ghi chú nào (B-0.1 → B-1.6)")
          : groups.map(([target, entries]) => (
              <div key={target} className="flex flex-col gap-0.5">
                <span className="text-[10.5px] font-bold text-[#6B6862]">{SECTION_LABEL[target] ?? target}</span>
                <ul className="list-disc pl-4 text-[11.5px] space-y-0.5">
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <span className="font-bold">{entry.topic}: </span>
                      {entry.content}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
      </section>

      {spine.other_requirements.length > 0 && (
        <section className="flex flex-col gap-1">
          <h5 className="text-[11px] font-extrabold text-[#8A867E] uppercase tracking-wide">Rủi ro & câu hỏi mở</h5>
          <ul className="list-disc pl-4 text-[11.5px] space-y-0.5">
            {spine.other_requirements.map((item) => (
              <li key={item.id}>
                <span className="font-bold">{OTHER_KIND_LABEL[item.kind] ?? item.kind}: </span>
                {item.statement}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
