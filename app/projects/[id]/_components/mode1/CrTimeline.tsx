"use client";

import { useTranslations } from "next-intl";
import type { CrStatus } from "@/types/change-request";
import { useMode1Labels } from "./i18n";

const STAGES = [
  { key: "draft", statuses: ["draft"] },
  { key: "clarify", statuses: ["clarifying", "awaiting_answers"] },
  { key: "impact", statuses: ["impact_review"] },
  { key: "propose", statuses: ["proposing"] },
  { key: "verify", statuses: ["verifying", "manual_fix"] },
  { key: "submit", statuses: ["ready_to_submit"] },
  { key: "review", statuses: ["in_review"] },
  { key: "written", statuses: ["written"] },
] as const satisfies readonly { key: string; statuses: readonly CrStatus[] }[];

/** Dòng thời gian trạng thái CR (máy trạng thái ở BE, FE chỉ đặt nhãn). */
export default function CrTimeline({ status }: { status: CrStatus }) {
  const t = useTranslations("mode1.crTimeline");
  const { crStatus } = useMode1Labels();
  const ended = status === "rejected" || status === "cancelled";
  const current = STAGES.findIndex((s) => (s.statuses as readonly CrStatus[]).includes(status));
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-body" aria-label={t("aria")}>
      {STAGES.map((s, i) => (
        <li
          key={s.key}
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
          {t(`stages.${s.key}`)}
        </li>
      ))}
      {ended && <li className="px-2.5 py-1 rounded-full font-bold bg-[#FDEDED] text-[#B03030]">{crStatus(status)}</li>}
    </ol>
  );
}
