"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@/lib/api/client";
import { userErrorMessage } from "@/lib/api/error-messages";
import {
  applyDocsAgentAction,
  dismissDocsAgentAction,
  googleDocUrl,
  type DocsAgentPendingAction,
} from "@/lib/api/google-docs-agent";

interface PendingActionCardProps {
  projectId: string;
  action: DocsAgentPendingAction;
  index: number;
}

type CardState = { kind: "idle" } | { kind: "working" } | { kind: "applied" } | { kind: "dismissed" } | { kind: "error"; message: string };

const MAX_SAMPLES = 3;
const asString = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * Một đề xuất sửa Google Doc của trợ lý: xem trước rồi Áp dụng (ghi thật, miễn phí) hoặc Bỏ qua. Tài liệu đã đổi so với
 * lúc xem trước ⇒ BE trả 409, thẻ nhắc nhờ trợ lý xem lại thay vì ghi chồng.
 */
export default function PendingActionCard({ projectId, action, index }: PendingActionCardProps) {
  const t = useTranslations("workspace.docsAssistant.action");
  const [state, setState] = useState<CardState>({ kind: "idle" });

  const run = async (kind: "apply" | "dismiss") => {
    setState({ kind: "working" });
    try {
      if (kind === "apply") await applyDocsAgentAction(projectId, action.id);
      else await dismissDocsAgentAction(projectId, action.id);
      setState({ kind: kind === "apply" ? "applied" : "dismissed" });
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : "";
      setState({
        kind: "error",
        message:
          code === "GOOGLE_DOC_CHANGED"
            ? t("docChanged")
            : code === "PENDING_ACTION_NOT_FOUND"
              ? t("expired")
              : userErrorMessage(err, t(kind === "apply" ? "applyFailed" : "dismissFailed")),
      });
    }
  };

  if (state.kind === "dismissed") {
    return <div className="text-caption text-[#8A867E] italic">{t("dismissed", { index })}</div>;
  }

  const isReplace = action.tool === "replace_text";
  const matches = Number(action.preview.matches ?? 0);
  const samples = Array.isArray(action.preview.samples)
    ? (action.preview.samples as Array<{ heading?: string | null; before?: string; after?: string }>).slice(0, MAX_SAMPLES)
    : [];
  const title = isReplace
    ? t("replaceTitle", { index, count: matches })
    : action.args.atEnd
      ? t("insertAtEndTitle", { index })
      : t("insertTitle", { index, heading: asString(action.preview.location) || asString(action.args.afterHeading) });
  const insertedText = asString(action.preview.text) || asString(action.args.text);

  return (
    <div className="rounded-[12px] border border-[#ECEAE5] bg-white p-3 flex flex-col gap-2 text-body">
      <div className="font-bold text-[#191817]">{title}</div>

      {isReplace ? (
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-caption">
            <div className="text-[#B03030]">- {asString(action.args.find)}</div>
            <div className="text-[#1F7A45]">+ {asString(action.args.replace)}</div>
          </div>
          {samples.map((sample, i) => (
            <div key={i} className="rounded-[8px] bg-[#FAF9F7] px-2 py-1.5 text-caption text-[#4B4842]">
              {sample.heading && <div className="text-[#8A867E]">{sample.heading}</div>}
              <div className="line-through decoration-[#B03030]/60">{sample.before}</div>
              <div>{sample.after}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[8px] bg-[#F1F8F3] px-2 py-1.5 text-caption text-[#1F5E36] whitespace-pre-wrap">
          {action.args.asHeading ? <span className="font-bold">{t("asHeading")} </span> : null}
          {insertedText
            .split("\n")
            .map((line) => `+ ${line}`)
            .join("\n")}
        </div>
      )}

      {state.kind === "applied" ? (
        <div className="flex items-center justify-between gap-2 text-[#1F7A45]">
          <span>✓ {t("applied")}</span>
          <a href={googleDocUrl(action.documentId)} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">
            {t("open")} ↗
          </a>
        </div>
      ) : (
        <>
          {state.kind === "error" && <div className="text-caption text-[#B03030]">{state.message}</div>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={state.kind === "working"}
              onClick={() => void run("dismiss")}
              className="px-3 py-1.5 rounded-[8px] text-body font-bold text-[#6B6862] hover:bg-[#F0EEEA] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("dismiss")}
            </button>
            <button
              type="button"
              disabled={state.kind === "working"}
              onClick={() => void run("apply")}
              className="px-3 py-1.5 rounded-[8px] text-body font-bold bg-[#191817] text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.kind === "working" ? t("working") : t("apply")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
