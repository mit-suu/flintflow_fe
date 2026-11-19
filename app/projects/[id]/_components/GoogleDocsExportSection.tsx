"use client";

import { useEffect, useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { ApiClientError } from "@/lib/api/client";
import { exportToGoogleDocs, type GoogleDocsExportMode, type GoogleDocsExportResult } from "@/lib/api/export";
import { getGoogleDocLinks, type GoogleDocLink, type GoogleDriveFolder } from "@/lib/api/google";
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
 *
 * File nằm trong `FlintFlow / <dự án>` trên Drive của người xuất. "Cập nhật" ghi đè đúng file cũ bằng dữ liệu web; Doc đã
 * bị sửa trong Google Docs sau lần xuất ⇒ BE trả `GOOGLE_DOC_MODIFIED`, hỏi lại trước khi ghi đè (`force`).
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
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
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

  // Chỉ file export của chính mình mới cập nhật được (`drive.file` gắn theo tài khoản Google); Doc liên kết không bao giờ bị ghi đè
  const previous = links.find(
    (link) =>
      link.isMine &&
      link.kind === "export" &&
      link.source === source &&
      (link.baselineId ?? null) === (baselineId ?? null) &&
      (!fileLanguage || link.lang === fileLanguage)
  );
  const effectiveMode: GoogleDocsExportMode = previous ? mode : "new";

  if (load.kind === "unavailable") {
    return <div className="text-body text-[#6B6862]">{t("unavailable")}</div>;
  }

  const handleExport = async (force = false) => {
    setWorking(true);
    setError(null);
    setConfirmOverwrite(false);
    setResult(null);
    try {
      // Gọi ngay trong cú click: chưa nối thì popup Google mở ở đây (sau một `await` mạng sẽ bị trình duyệt chặn)
      await ensureConnected();
      const exported = await exportToGoogleDocs(projectId, { source, baselineId, lang }, effectiveMode, force);
      setResult(exported);
      setLinks(await getGoogleDocLinks(projectId).catch(() => links));
    } catch (err) {
      if (err instanceof GoogleConsentCancelledError) {
        setError(t("cancelled"));
        return;
      }
      if (err instanceof ApiClientError && err.code === "GOOGLE_DOC_MODIFIED") {
        setConfirmOverwrite(true);
        return;
      }
      if (err instanceof ApiClientError && err.code === "GOOGLE_RECONNECT_REQUIRED") markReconnectRequired();
      setError(userErrorMessage(err, t("failed")));
    } finally {
      setWorking(false);
    }
  };

  const needsConnect = load.kind === "ready" && load.status.status !== "connected";
  const buttonLabel = working
    ? t("exporting")
    : needsConnect
      ? t("connectAndExport")
      : effectiveMode === "update"
        ? t("updateButton")
        : t("export");

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
          {previous.stale && <StaleBadge label={t("stale")} hint={t("staleHint")} />}
          {previous.folder && <FolderLine folder={previous.folder} label={t("savedIn")} openLabel={t("openFolder")} />}

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

      {confirmOverwrite && (
        <div role="alert" className="p-3.5 rounded-[12px] border border-[#F0D9A8] bg-[#FFF8EA] flex flex-col gap-2.5 text-body text-[#6B4A00]">
          <p>{t("modifiedConfirm")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleExport(true)}
              className="px-3 py-1.5 rounded-[8px] bg-[#191817] text-white font-bold cursor-pointer"
            >
              {t("overwrite")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOverwrite(false)}
              className="px-3 py-1.5 rounded-[8px] bg-white border border-[#E4E1DB] font-bold text-[#191817] cursor-pointer"
            >
              {t("keepEdits")}
            </button>
          </div>
        </div>
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
            {result.folder && <FolderLine folder={result.folder} label={t("savedIn")} openLabel={t("openFolder")} />}
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
        {buttonLabel}
      </button>

      <p className="text-caption text-[#8A867E] leading-relaxed">{t("officialNote")}</p>

      {links.length > 0 && <ProjectDocs links={links} />}
    </div>
  );
}

function StaleBadge({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-[#8A5A00]">
      <span className="rounded-full bg-[#FFF1D6] px-2 py-0.5 font-bold">{label}</span>
      {hint}
    </span>
  );
}

function FolderLine({ folder, label, openLabel }: { folder: GoogleDriveFolder; label: string; openLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-caption">
      <span className="min-w-0 truncate">
        {label} <span className="font-bold">{folder.path}</span>
      </span>
      <a href={folder.url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-bold hover:underline">
        {openLabel} ↗
      </a>
    </div>
  );
}

/** Google Doc của cả dự án — mọi thành viên thấy; chỉ chủ file cập nhật / dùng trợ lý được. */
function ProjectDocs({ links }: { links: GoogleDocLink[] }) {
  const t = useTranslations("workspace.export.googleDocs");
  return (
    <section aria-label={t("projectDocs")} className="flex flex-col gap-2 pt-1">
      <h4 className="text-caption font-bold uppercase tracking-wide text-[#8A867E]">{t("projectDocs")}</h4>
      <ul className="flex flex-col gap-1.5">
        {links.map((link) => (
          <li key={`${link.fileId}-${link.owner.id}`} className="flex flex-col gap-0.5 rounded-[10px] border border-[#ECEAE5] px-3 py-2 text-body">
            <div className="flex items-center gap-2 min-w-0">
              <a href={link.webViewLink} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-bold text-[#191817] hover:underline">
                {link.title}
              </a>
              {link.kind === "linked" && <span className="shrink-0 rounded-full bg-[#EEF0FB] px-2 py-0.5 text-caption text-[#4B4FA6]">{t("linkedBadge")}</span>}
              {link.stale && <span className="shrink-0 rounded-full bg-[#FFF1D6] px-2 py-0.5 text-caption font-bold text-[#8A5A00]">{t("stale")}</span>}
            </div>
            <span className="text-caption text-[#8A867E] truncate">
              {link.isMine ? t("ownerMe") : t("ownerOther", { name: link.owner.name ?? link.owner.email ?? "?" })}
              {link.folder ? ` · ${link.folder.path}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
