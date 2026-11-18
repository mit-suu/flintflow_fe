"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
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
          {previous.stale && <StaleBadge label={t("stale")} hint={t("staleHint")} />}
          {previous.folder && <FolderLine folder={previous.folder} label={t("savedIn")} openLabel={t("openFolder")} />}
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
        <div role="status" className="p-3 rounded-[12px] bg-[#EAF6EE] text-body text-[#1F7A45] flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0">
              ✓ {t(result.mode === "update" ? "updated" : "created", { title: result.title })}
              {result.recreated && <span className="block text-caption">{t("recreated")}</span>}
            </span>
            <a href={result.webViewLink} target="_blank" rel="noopener noreferrer" className="shrink-0 font-bold hover:underline">
              {t("openGoogleDocs")} ↗
            </a>
          </div>
          {result.folder && <FolderLine folder={result.folder} label={t("savedIn")} openLabel={t("openFolder")} />}
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
