"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
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
      <p className="text-caption text-[#6B6862]">{t("officialNote")}</p>

      {previous && (
        <div className="bg-[#FAF9F7] border border-[#ECEAE5] rounded-[12px] p-3.5 flex flex-col gap-2 text-body text-[#4B4842]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">
              {t("lastExport", {
                time: format.dateTime(new Date(previous.exportedAt), { dateStyle: "short", timeStyle: "short" }),
                title: previous.title,
              })}
            </span>
            <a
              href={previous.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 font-bold text-[#191817] hover:underline"
            >
              {t("open")} ↗
            </a>
          </div>
          <div role="radiogroup" aria-label={t("modeLabel")} className="flex flex-col gap-1.5">
            {(["update", "new"] as const).map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="google-docs-mode"
                  checked={mode === option}
                  onChange={() => setMode(option)}
                />
                {t(option === "update" ? "modeUpdate" : "modeNew")}
              </label>
            ))}
          </div>
          {mode === "update" && <div className="text-caption text-[#8A5A00]">⚠ {t("overwriteWarning")}</div>}
        </div>
      )}

      {result && (
        <div role="status" className="p-3 rounded-[12px] bg-[#EAF6EE] text-body text-[#1F7A45] flex items-center justify-between gap-2">
          <span className="min-w-0">
            ✓ {t(result.mode === "update" ? "updated" : "created", { title: result.title })}
            {result.recreated && <span className="block text-caption">{t("recreated")}</span>}
          </span>
          <a href={result.webViewLink} target="_blank" rel="noopener noreferrer" className="shrink-0 font-bold hover:underline">
            {t("openGoogleDocs")} ↗
          </a>
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
    </div>
  );
}
