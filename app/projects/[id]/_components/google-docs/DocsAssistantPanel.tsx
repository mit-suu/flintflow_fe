"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiClientError } from "@/lib/api/client";
import { userErrorMessage } from "@/lib/api/error-messages";
import { exportToGoogleDocs } from "@/lib/api/export";
import { getGoogleAccessToken, getGoogleDocLinks, linkGoogleDoc, unlinkGoogleDoc, type GoogleDocLink } from "@/lib/api/google";
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
  linked: boolean;
}

/** Doc trợ lý dùng được: thuộc dự án và do chính mình xuất / liên kết (`drive.file` gắn theo tài khoản Google). Bỏ trùng. */
const toOptions = (links: GoogleDocLink[]): DocOption[] => {
  const seen = new Set<string>();
  return links
    .filter((l) => l.isMine && !seen.has(l.fileId) && seen.add(l.fileId))
    .map((l) => ({ id: l.fileId, title: l.title, linked: l.kind === "linked" }));
};

/**
 * Panel "Trợ lý Google Docs": chọn một Google Doc **của dự án** (đã xuất, hoặc đã liên kết vào dự án), rồi chat. Trợ lý chỉ
 * đọc và tạo đề xuất; Google Doc đổi khi người dùng bấm Áp dụng trên từng thẻ đề xuất. BE cũng chặn Doc ngoài dự án
 * (`GOOGLE_DOC_NOT_IN_PROJECT`).
 *
 * Chỉ mount khi FE có client id Google (`useGoogleConnect` cần `GoogleOAuthProvider`) — `page.tsx` kiểm điều đó.
 */
export default function DocsAssistantPanel({ projectId, onClose }: DocsAssistantPanelProps) {
  const t = useTranslations("workspace.docsAssistant");
  const locale = useLocale();
  const google = useGoogleConnect();
  const [options, setOptions] = useState<DocOption[]>([]);
  const [othersCount, setOthersCount] = useState(0);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const applyLinks = (links: GoogleDocLink[], select?: string) => {
    const docs = toOptions(links);
    setOptions(docs);
    setOthersCount(new Set(links.filter((l) => !l.isMine).map((l) => l.fileId)).size);
    setDocumentId((current) => {
      const wanted = select ?? current;
      return wanted && docs.some((d) => d.id === wanted) ? wanted : (docs[0]?.id ?? null);
    });
  };

  useEffect(() => {
    let cancelled = false;
    getGoogleDocLinks(projectId)
      .then((links) => {
        if (!cancelled) applyLinks(links);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  /** Chạy một thao tác cần Google (popup nối mở ngay trong cú click), rồi tải lại danh sách Doc của dự án. */
  const runGoogleAction = async (action: () => Promise<string | null | undefined>, fallbackError: string) => {
    setActionError(null);
    setBusy(true);
    try {
      await google.ensureConnected();
      const select = await action();
      if (select === undefined) return;
      applyLinks(await getGoogleDocLinks(projectId), select ?? undefined);
    } catch (err) {
      if (err instanceof GoogleConsentCancelledError) setActionError(t("cancelled"));
      else {
        if (err instanceof ApiClientError && err.code === "GOOGLE_RECONNECT_REQUIRED") google.markReconnectRequired();
        setActionError(err instanceof ApiClientError ? userErrorMessage(err, fallbackError) : fallbackError);
      }
    } finally {
      setBusy(false);
    }
  };

  /** Liên kết một Google Doc có sẵn (chọn trong Picker, chỉ Google Docs) vào dự án — lưu ở BE, ai trong dự án cũng thấy. */
  const linkDocument = () =>
    runGoogleAction(async () => {
      const { accessToken } = await getGoogleAccessToken();
      const file = await pickGoogleFile({ accessToken, locale, mimeTypes: [GOOGLE_DOC_MIME] });
      if (!file) return undefined;
      return (await linkGoogleDoc(projectId, file.id)).fileId;
    }, t("pickerFailed"));

  /** Dự án chưa có Doc ⇒ xuất bản nháp SRS sang Google Docs ngay tại đây. */
  const exportDraft = () =>
    runGoogleAction(async () => (await exportToGoogleDocs(projectId, { source: "draft" }, "new")).fileId, t("exportFailed"));

  const unlinkSelected = async () => {
    if (!documentId) return;
    setActionError(null);
    setBusy(true);
    try {
      await unlinkGoogleDoc(projectId, documentId);
      applyLinks(await getGoogleDocLinks(projectId));
    } catch (err) {
      setActionError(userErrorMessage(err, t("unlinkFailed")));
    } finally {
      setBusy(false);
    }
  };

  const selected = options.find((o) => o.id === documentId);

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
                  {o.linked ? t("linkedOption", { title: o.title }) : o.title}
                </option>
              ))}
            </select>
            {documentId && (
              <a href={googleDocUrl(documentId)} target="_blank" rel="noopener noreferrer" className="font-bold text-[#191817] hover:underline">
                {t("open")} ↗
              </a>
            )}
            {selected?.linked && (
              <button type="button" disabled={busy} onClick={() => void unlinkSelected()} className="font-bold text-[#8A867E] hover:underline cursor-pointer disabled:opacity-50">
                {t("unlink")}
              </button>
            )}
            {isGooglePickerConfigured && (
              <button type="button" disabled={busy} onClick={() => void linkDocument()} className="font-bold text-[#6A62C4] hover:underline cursor-pointer disabled:opacity-50">
                {t("linkDoc")}
              </button>
            )}
            <p className="basis-full text-caption text-[#8A867E]">
              {t("scopeNote")}
              {othersCount > 0 && ` ${t("othersNote", { count: othersCount })}`}
            </p>
            {actionError && <p className="basis-full text-caption text-[#B03030]">{actionError}</p>}
          </div>

          {documentId ? (
            <Conversation key={documentId} projectId={projectId} documentId={documentId} google={google} />
          ) : (
            <div className="p-4 flex flex-col items-start gap-3">
              <p className="text-body text-[#6B6862] leading-relaxed">{t("empty")}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void exportDraft()}
                className="px-3 py-2 rounded-[10px] bg-[#191817] text-white text-body font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? t("working") : t("exportDraft")}
              </button>
            </div>
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
