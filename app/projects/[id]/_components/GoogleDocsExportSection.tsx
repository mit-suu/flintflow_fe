"use client";

import { useEffect, useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { ApiClientError } from "@/lib/api/client";
import { exportToGoogleDocs, type GoogleDocsExportMode, type GoogleDocsExportResult } from "@/lib/api/export";
import { getGoogleDocLinks, type GoogleDocLink } from "@/lib/api/google";
import { userErrorMessage } from "@/lib/api/error-messages";
import { GoogleConsentCancelledError, useGoogleConnect } from "@/lib/hooks/use-google-connect";
import type { DocumentSource } from "@/types/document";
import type { DocumentLanguage } from "@/types/project";

interface GoogleDocsExportSectionProps {
  projectId: string;
  source: DocumentSource;
  baselineId?: string;
  /** `lang` gửi lên BE — chỉ khi user chọn ngôn ngữ khác ngôn ngữ tài liệu (như tải Word). */
  lang?: DocumentLanguage;
  /** Ngôn ngữ của file sẽ ra — để tìm Google Doc đã xuất cùng ngôn ngữ. Không biết ⇒ khớp mọi ngôn ngữ. */
  fileLanguage?: DocumentLanguage;
  disabled?: boolean;
}

/**
 * Phần "Google Docs" của ExportPanel (contract #44, #45). Tách component riêng vì `useGoogleConnect` chỉ chạy được trong
 * `GoogleOAuthProvider` — ExportPanel chỉ mount phần này khi có client id và user chọn định dạng Google Docs.
 */
export default function GoogleDocsExportSection({
  projectId,
  source,
  baselineId,
  lang,
  fileLanguage,
  disabled = false,
}: GoogleDocsExportSectionProps) {
  const t = useTranslations("workspace.export.googleDocs");
  const format = useFormatter();
  const { load, ensureConnected, markReconnectRequired } = useGoogleConnect();
  const [links, setLinks] = useState<GoogleDocLink[]>([]);
  const [mode, setMode] = useState<GoogleDocsExportMode>("update");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GoogleDocsExportResult | null>(null);
  const modeLabelId = useId();

  useEffect(() => {
    let cancelled = false;
    // Không tải được danh sách ⇒ chỉ mất lựa chọn "cập nhật file cũ", vẫn xuất bản mới được
    getGoogleDocLinks(projectId)
      .then((next) => {
        if (!cancelled) setLinks(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const previous = links.find(
    (link) =>
      link.source === source &&
      (link.baselineId ?? null) === (baselineId ?? null) &&
      (!fileLanguage || link.lang === fileLanguage)
  );
  const effectiveMode: GoogleDocsExportMode = previous ? mode : "new";

  if (load.kind === "unavailable") {
    return <div className="text-body text-[#6B6862]">{t("unavailable")}</div>;
  }

  const handleExport = async () => {
    setWorking(true);
    setError(null);
    setResult(null);
    try {
      // Gọi ngay trong cú click: chưa nối thì popup Google mở ở đây (sau một `await` mạng sẽ bị trình duyệt chặn)
      await ensureConnected();
      const exported = await exportToGoogleDocs(projectId, { source, baselineId, lang }, effectiveMode);
      setResult(exported);
      setLinks(await getGoogleDocLinks(projectId).catch(() => links));
    } catch (err) {
      if (err instanceof GoogleConsentCancelledError) {
        setError(t("cancelled"));
        return;
      }
      if (err instanceof ApiClientError && err.code === "GOOGLE_RECONNECT_REQUIRED") markReconnectRequired();
      setError(userErrorMessage(err, t("failed")));
    } finally {
      setWorking(false);
    }
  };

  const needsConnect = load.kind === "ready" && load.status.status !== "connected";

  return (
    <div className="flex flex-col gap-3">
      {previous && (
        <>
          {/* File đã xuất lần trước: phẳng, tên file xuống dòng thay vì bị cắt */}
          <div className="bg-[#FAF9F7] rounded-[12px] p-3.5 flex items-start justify-between gap-3 text-body text-[#4B4842]">
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="text-caption text-[#6B6862]">
                {t("lastExport", {
                  time: format.dateTime(new Date(previous.exportedAt), { dateStyle: "short", timeStyle: "short" }),
                })}
              </span>
              <span className="font-bold text-[#191817] break-words">{previous.title}</span>
            </div>
            <a
              href={previous.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1 font-bold text-[#191817] hover:underline"
            >
              {t("open")}
              <Icon name="export" size={13} />
            </a>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span id={modeLabelId} className="text-body text-[#4B4842]">
              {t("modeLabel")}
            </span>
            <div role="radiogroup" aria-labelledby={modeLabelId} className="flex gap-1 p-1 rounded-full bg-[#F0EEEA]">
              {(["update", "new"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={mode === option}
                  onClick={() => setMode(option)}
                  className={`px-3 py-1 rounded-full text-body font-bold whitespace-nowrap cursor-pointer ${
                    mode === option ? "bg-white text-[#191817] shadow-sm" : "text-[#6B6862]"
                  }`}
                >
                  {t(option === "update" ? "modeUpdate" : "modeNew")}
                </button>
              ))}
            </div>
          </div>

          {mode === "update" && (
            <div className="bg-accent-gold-soft rounded-control p-3 text-body text-accent-gold-text leading-relaxed flex items-start gap-2">
              <Icon name="warning" size={14} className="mt-0.5 shrink-0" />
              <span>{t("overwriteWarning")}</span>
            </div>
          )}
        </>
      )}

      {result && (
        <div role="status" className="p-3 rounded-[12px] bg-[#EAF6EE] text-body text-[#1F7A45] flex items-start gap-2">
          <Icon name="check-circle" size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex flex-col items-start gap-1">
            <span className="break-words">{t(result.mode === "update" ? "updated" : "created", { title: result.title })}</span>
            {result.recreated && <span className="text-caption">{t("recreated")}</span>}
            <a
              href={result.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold hover:underline"
            >
              {t("openGoogleDocs")}
              <Icon name="export" size={13} />
            </a>
          </div>
        </div>
      )}

      {error && <div className="text-body text-[#B03030]">{error}</div>}

      <button
        type="button"
        disabled={disabled || working || load.kind === "loading"}
        onClick={() => void handleExport()}
        className="w-full py-2.5 rounded-[10px] bg-[#191817] text-white text-body font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
      >
        {working ? t("exporting") : needsConnect ? t("connectAndExport") : t("export")}
      </button>

      <p className="text-caption text-[#8A867E] leading-relaxed">{t("officialNote")}</p>
    </div>
  );
}
