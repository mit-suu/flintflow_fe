"use client";

import type { CrStatus } from "@/types/change-request";
import { CR_STATUS_LABELS } from "./labels";

const STAGES: { label: string; statuses: CrStatus[] }[] = [
  { label: "Nháp", statuses: ["draft"] },
  { label: "Làm rõ", statuses: ["clarifying", "awaiting_answers"] },
  { label: "Vị trí ảnh hưởng", statuses: ["impact_review"] },
  { label: "Đề xuất", statuses: ["proposing"] },
  { label: "Kiểm", statuses: ["verifying", "manual_fix"] },
  { label: "Nộp", statuses: ["ready_to_submit"] },
  { label: "Duyệt", statuses: ["in_review"] },
  { label: "Ghi Track Changes", statuses: ["written"] },
];

/** Dòng thời gian trạng thái CR (máy trạng thái ở BE, FE chỉ đặt nhãn). */
export default function CrTimeline({ status }: { status: CrStatus }) {
  const ended = status === "rejected" || status === "cancelled";
  const current = STAGES.findIndex((s) => s.statuses.includes(status));
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-[11.5px]" aria-label="Tiến trình change request">
      {STAGES.map((s, i) => (
        <li
          key={s.label}
          aria-current={i === current ? "step" : undefined}
          className={`px-2.5 py-1 rounded-full font-bold ${
            ended
              ? "bg-[#F0EEEA] text-[#C9C5BD]"
              : i < current
                ? "bg-[#E9F7EE] text-[#1F7A45]"
                : i === current
                  ? status === "written"
                    ? "bg-[#1F7A45] text-white"
                    : "bg-[#191817] text-white"
                  : "bg-[#F0EEEA] text-[#A8A49C]"
          }`}
        >
          {s.label}
        </li>
      ))}
      {ended && <li className="px-2.5 py-1 rounded-full font-bold bg-[#FDEDED] text-[#B03030]">{CR_STATUS_LABELS[status]}</li>}
    </ol>
  );
}
