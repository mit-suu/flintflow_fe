"use client";

import { useTranslations } from "next-intl";
import type { StepEvent } from "@/types/pipeline";

interface StepEventLogProps {
  events: StepEvent[];
}

/** `useTranslations("workspace.stepLog")` — truyền vào để `describeEvent` vẫn là hàm thuần. */
export type StepLogTranslator = (
  key:
    | "intakeMissing"
    | "intakeOk"
    | "elicit"
    | "answerNeeded"
    | "draft"
    | "opsApplied"
    | "renderOk"
    | "renderFailed"
    | "flags"
    | "gateReady"
    | "error",
  values?: Record<string, string | number>
) => string;

/** Một dòng mô tả cho mỗi sự kiện SSE của step. */
export const describeEvent = (event: StepEvent, t: StepLogTranslator): string => {
  switch (event.type) {
    case "intake":
      return event.empty_fields.length > 0 ? t("intakeMissing", { fields: event.empty_fields.join(", ") }) : t("intakeOk");
    case "elicit":
      return t("elicit");
    case "answer_needed":
      return t("answerNeeded", { count: event.questions.length });
    case "draft":
      return t("draft", { attempt: event.attempt });
    case "ops_applied":
      return t("opsApplied", { count: event.changes.length, version: event.spine_version });
    case "render":
      return event.render_status === "ok"
        ? t("renderOk", { id: event.diagram_id })
        : t("renderFailed", { id: event.diagram_id, error: event.error ?? "" });
    case "flags":
      return t("flags", { red: event.red_open, yellow: event.yellow_open });
    case "gate_ready":
      return t("gateReady");
    case "error":
      return t("error", { code: event.code, message: event.message });
  }
};

export default function StepEventLog({ events }: StepEventLogProps) {
  const t = useTranslations("workspace.stepLog");
  const visible = events.filter((e) => e.type !== "elicit");
  if (visible.length === 0) return null;
  return (
    <ol className="flex flex-col gap-1 bg-white border border-[#ECEAE5] rounded-[12px] p-3" aria-label={t("aria")}>
      {visible.map((event, index) => (
        <li key={index} className={`text-[11.5px] flex items-center gap-2 ${event.type === "error" ? "text-[#B03030]" : "text-[#4B4842]"}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
          {describeEvent(event, t)}
        </li>
      ))}
    </ol>
  );
}
