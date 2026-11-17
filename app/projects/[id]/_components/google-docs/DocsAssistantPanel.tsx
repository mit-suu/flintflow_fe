"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiClientError } from "@/lib/api/client";
import { userErrorMessage } from "@/lib/api/error-messages";
import { getGoogleAccessToken, getGoogleDocLinks } from "@/lib/api/google";
import { googleDocUrl } from "@/lib/api/google-docs-agent";
import { GOOGLE_DOC_MIME, isGooglePickerConfigured, pickGoogleFile } from "@/lib/google-picker";
import { GoogleConsentCancelledError, useGoogleConnect } from "@/lib/hooks/use-google-connect";
import { useDocsAssistant, type AssistantMessage, type AssistantToolCall } from "../../hooks/useDocsAssistant";
import PendingActionCard from "./PendingActionCard";

interface DocsAssistantPanelProps {
  projectId: string;
  onClose: () => void;
}

interface DocOption {
  id: string;
  title: string;
}

/**
 * Panel "Trợ lý Google Docs": chọn một Google Doc (đã xuất từ dự án, hoặc chọn trên Drive), rồi chat. Trợ lý chỉ đọc và
 * tạo đề xuất; Google Doc đổi khi người dùng bấm Áp dụng trên từng thẻ đề xuất.
 *
 * Chỉ mount khi FE có client id Google (`useGoogleConnect` cần `GoogleOAuthProvider`) — `page.tsx` kiểm điều đó.
 */
export default function DocsAssistantPanel({ projectId, onClose }: DocsAssistantPanelProps) {
  const t = useTranslations("workspace.docsAssistant");
  const locale = useLocale();
  const google = useGoogleConnect();
  const [options, setOptions] = useState<DocOption[]>([]);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGoogleDocLinks(projectId)
      .then((links) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const docs = links.filter((l) => !seen.has(l.fileId) && seen.add(l.fileId)).map((l) => ({ id: l.fileId, title: l.title }));
        setOptions(docs);
        setDocumentId((current) => current ?? docs[0]?.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const pickOther = async () => {
    setPickError(null);
    try {
      await google.ensureConnected();
      const { accessToken } = await getGoogleAccessToken();
      const file = await pickGoogleFile({ accessToken, locale, mimeTypes: [GOOGLE_DOC_MIME] });
      if (!file) return;
      setOptions((prev) => (prev.some((o) => o.id === file.id) ? prev : [{ id: file.id, title: file.name }, ...prev]));
      setDocumentId(file.id);
    } catch (err) {
      if (err instanceof GoogleConsentCancelledError) setPickError(t("cancelled"));
      else setPickError(err instanceof ApiClientError ? userErrorMessage(err) : t("pickerFailed"));
    }
  };

  return (
    <aside
      aria-label={t("title")}
      className="fixed inset-y-0 right-0 z-50 w-[460px] max-w-full bg-white shadow-[0_0_60px_rgba(0,0,0,0.18)] flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#ECEAE5]">
        <h3 className="font-extrabold text-heading text-[#191817]">{t("title")}</h3>
        <button type="button" onClick={onClose} aria-label={t("close")} className="p-1.5 hover:bg-[#F5F3F0] rounded-full text-[#8A867E] cursor-pointer">
          ✕
        </button>
      </div>

      {google.load.kind === "unavailable" ? (
        <p className="p-4 text-body text-[#6B6862]">{t("unavailable")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[#ECEAE5] text-body">
            <label htmlFor="docs-assistant-doc" className="text-[#4B4842]">
              {t("document")}
            </label>
            <select
              id="docs-assistant-doc"
              value={documentId ?? ""}
              onChange={(e) => setDocumentId(e.target.value || null)}
              className="min-w-0 flex-1 rounded-[8px] border border-[#E4E1DB] px-2 py-1"
            >
              {!documentId && <option value="">{t("noDocument")}</option>}
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
            {documentId && (
              <a href={googleDocUrl(documentId)} target="_blank" rel="noopener noreferrer" className="font-bold text-[#191817] hover:underline">
                {t("open")} ↗
              </a>
            )}
            {isGooglePickerConfigured && (
              <button type="button" onClick={() => void pickOther()} className="font-bold text-[#6A62C4] hover:underline cursor-pointer">
                {t("pickOther")}
              </button>
            )}
            {pickError && <p className="basis-full text-caption text-[#B03030]">{pickError}</p>}
          </div>

          {documentId ? (
            <Conversation key={documentId} projectId={projectId} documentId={documentId} google={google} />
          ) : (
            <p className="p-4 text-body text-[#6B6862] leading-relaxed">{t("empty")}</p>
          )}
        </>
      )}
    </aside>
  );
}

function Conversation({
  projectId,
  documentId,
  google,
}: {
  projectId: string;
  documentId: string;
  google: ReturnType<typeof useGoogleConnect>;
}) {
  const t = useTranslations("workspace.docsAssistant");
  const { messages, sending, send, stop } = useDocsAssistant(projectId, documentId, google.markReconnectRequired);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "end" });
  }, [messages]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setError(null);
    try {
      // Chưa nối / cần nối lại ⇒ popup Google mở ngay trong cú bấm Gửi
      await google.ensureConnected();
    } catch (err) {
      setError(err instanceof GoogleConsentCancelledError ? t("cancelled") : userErrorMessage(err));
      return;
    }
    setDraft("");
    await send(text);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.length === 0 && <p className="text-body text-[#8A867E]">{t("intro")}</p>}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} projectId={projectId} />
        ))}
        <div ref={bottom} />
      </div>

      <form
        className="border-t border-[#ECEAE5] px-4 py-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {error && <p className="text-caption text-[#B03030]">{error}</p>}
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            rows={2}
            maxLength={4000}
            className="flex-1 resize-none rounded-[10px] border border-[#E4E1DB] px-3 py-2 text-body"
          />
          {sending ? (
            <button type="button" onClick={stop} className="self-end px-3 py-2 rounded-[10px] bg-[#F0EEEA] text-body font-bold cursor-pointer">
              {t("stop")}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className="self-end px-3 py-2 rounded-[10px] bg-[#191817] text-white text-body font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("send")}
            </button>
          )}
        </div>
        <p className="text-caption text-[#8A867E]">{t("creditNote")}</p>
      </form>
    </>
  );
}

function ToolChip({ call }: { call: AssistantToolCall }) {
  const t = useTranslations("workspace.docsAssistant.tools");
  const label =
    call.name === "read_section"
      ? t("read_section", { heading: call.args.heading ?? "" })
      : call.name === "search_text"
        ? t("search_text", { query: call.args.query ?? "" })
        : call.name === "get_outline" || call.name === "replace_text" || call.name === "insert_text"
          ? t(call.name)
          : call.name;
  return <span className="inline-flex items-center rounded-full bg-[#F0EEEA] px-2 py-0.5 text-caption text-[#6B6862]">◦ {label}</span>;
}

function MessageBubble({ message, projectId }: { message: AssistantMessage; projectId: string }) {
  const t = useTranslations("workspace.docsAssistant");
  if (message.role === "user") {
    return <div className="self-end max-w-[85%] rounded-[12px] bg-[#191817] text-white px-3 py-2 text-body whitespace-pre-wrap">{message.content}</div>;
  }
  return (
    <div className="flex flex-col gap-2 max-w-[95%]">
      {message.toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.toolCalls.map((call, i) => (
            <ToolChip key={i} call={call} />
          ))}
        </div>
      )}
      {message.content ? (
        <div className="rounded-[12px] bg-[#FAF9F7] px-3 py-2 text-body text-[#191817] whitespace-pre-wrap">{message.content}</div>
      ) : message.status === "streaming" ? (
        <div className="text-body text-[#8A867E] italic">{t("thinking")}</div>
      ) : message.status === "done" && message.pendingActions.length === 0 ? (
        <div className="text-body text-[#8A867E] italic">{t("stopped")}</div>
      ) : null}
      {message.pendingActions.map((action, i) => (
        <PendingActionCard key={action.id} projectId={projectId} action={action} index={i + 1} />
      ))}
      {message.status === "error" && message.error && <div className="text-caption text-[#B03030]">{message.error}</div>}
    </div>
  );
}
