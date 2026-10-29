"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@/lib/api/client";
import { saveBlob } from "@/lib/api/files";
import { getSpine } from "@/lib/api/spine";
import { downloadVersion, releaseDocument } from "@/lib/api/versions";
import { isReleaseVersion, versionFileName, versionLineage, type DocVersion, type DownloadFormat, type DownloadVariant } from "@/types/doc-version";
import type { Flag } from "@/types/spine";
import { useMode1Labels } from "./i18n";
import { crHref } from "./prefill";

interface VersionsPanelProps {
  projectId: string;
  projectName?: string;
  /** Mới nhất trước. */
  versions: DocVersion[];
  /** Cờ đỏ đang mở — `null` khi chưa tải. */
  redOpen: number | null;
  /** Version đang xem — bỏ trống khi panel chỉ liệt kê (workspace mode 1 v2 xem tài liệu ở DocumentPane). */
  selected?: string | null;
  onSelect?: (version: string) => void;
  /** Sau release: tải lại danh sách, header. */
  onReleased: () => void;
  /** Viewer / Analyst: ẩn mục Release (chỉ Lead release) — vẫn xem và tải các version. */
  readOnly?: boolean;
}

/**
 * Version & release (Flow 6, UC-57): `0.1` import → `0.x` sau mỗi CR (Track Changes + DRAFT) → `x.0` release
 * (bản sạch). Release bị khoá khi còn cờ đỏ (BR-04, mode 1 không waive) — BE vẫn chặn lần nữa.
 */
export default function VersionsPanel({ projectId, projectName, versions, redOpen, selected, onSelect, onReleased, readOnly = false }: VersionsPanelProps) {
  const t = useTranslations("mode1.versions");
  const L = useMode1Labels();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockingFlags, setBlockingFlags] = useState<Flag[]>([]);

  const latest = versions[0] ?? null;
  const alreadyReleased = latest ? isReleaseVersion(latest.version) : false;
  const releaseBlockedReason =
    redOpen === null ? t("checkingFlags") : redOpen > 0 ? t("redFlagsOpen", { count: redOpen }) : !latest ? t("noDocument") : null;

  const download = async (version: string, variant: DownloadVariant, format: DownloadFormat = "docx") => {
    setBusy(`download:${version}:${variant}:${format}`);
    setError(null);
    try {
      const { blob, filename } = await downloadVersion(projectId, version, variant, format);
      // Tên dự phòng khi BE không gửi `Content-Disposition` — cùng quy tắc FLF-334 với BE
      const fallback = versionFileName({
        name: projectName ?? "SRS",
        ...versionLineage(versions, version),
        tracked: variant === "tracked",
        original: variant === "original",
        ext: format,
      });
      saveBlob(blob, filename ?? fallback);
    } catch (err) {
      setError(L.errorText(err, t("downloadFailed")));
    } finally {
      setBusy(null);
    }
  };

  const release = async () => {
    setBusy("release");
    setError(null);
    setBlockingFlags([]);
    try {
      const spine = await getSpine(projectId);
      await releaseDocument(projectId, spine.data?.spine_version ?? 0);
      setConfirming(false);
      onReleased();
    } catch (err) {
      setError(L.errorText(err, t("releaseFailed")));
      if (err instanceof ApiClientError && err.code === "RELEASE_RED_FLAGS_OPEN") setBlockingFlags((err.meta?.flags as Flag[] | undefined) ?? []);
      if (err instanceof ApiClientError && err.code === "SPINE_VERSION_CONFLICT") onReleased();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && (
      <section className="flex flex-col gap-2">
        <h3 className="font-extrabold text-[#191817] text-body">{t("releaseTitle")}</h3>
        <p className="text-body text-[#8A867E] leading-relaxed">{t("releaseHint")}</p>
        {confirming ? (
          <div className="flex flex-col gap-2 bg-[#F2F1FB] border border-[#DCD8F0] rounded-[10px] p-3 text-body text-[#554DB0]">
            <p>{t("confirmQuestion", { version: latest?.version ?? "" })}</p>
            {alreadyReleased && <p className="text-[#8A6D1F]">{t("alreadyReleased")}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirming(false)} disabled={busy === "release"} className="px-3 py-1 rounded-[8px] border border-[#DCD8F0] bg-white font-semibold">
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void release()}
                disabled={busy === "release"}
                className="px-3 py-1 rounded-[8px] bg-[#6A62C4] text-white font-bold disabled:opacity-50"
              >
                {busy === "release" ? t("releasing") : t("confirmRelease")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={releaseBlockedReason !== null}
            title={releaseBlockedReason ?? undefined}
            className="px-4 py-2 rounded-[10px] btn-gradient-primary text-white text-body font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {t("release")}
          </button>
        )}
        {releaseBlockedReason && !confirming && <p className="text-body text-[#8A6D1F]">{releaseBlockedReason}</p>}
        {error && (
          <div role="alert" className="text-body text-[#B03030] bg-[#FDEDED] border border-[#F2CACA] rounded-[10px] px-3 py-2">
            {error}
            {blockingFlags.length > 0 && (
              <ul className="list-disc pl-4 mt-1">
                {blockingFlags.map((f) => (
                  <li key={f.id}>{L.humanizeText(f.message)}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="font-extrabold text-[#191817] text-body">{t("listTitle")}</h3>
        <ul className="flex flex-col gap-2">
          {versions.map((v) => {
            const release = isReleaseVersion(v.version);
            return (
              <li
                key={v.version}
                className={`rounded-[12px] border px-3 py-2.5 flex flex-col gap-1.5 ${selected === v.version ? "border-[#6A62C4] bg-[#F2F1FB]" : "border-[#ECEAE5] bg-white"}`}
              >
                <div className="flex items-center gap-2">
                  {onSelect ? (
                    <button type="button" onClick={() => onSelect(v.version)} className="font-extrabold text-[#191817] text-heading hover:underline" aria-label={t("viewVersion", { version: v.version })}>
                      {v.version}
                    </button>
                  ) : (
                    <span className="font-extrabold text-[#191817] text-heading">{v.version}</span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-caption font-bold ${
                      release ? "bg-[#E9F7EE] text-[#1F7A45]" : v.kind === "imported" ? "bg-[#F0EEEA] text-[#4B4842]" : "bg-[#FBF4E4] text-[#8A6D1F]"
                    }`}
                  >
                    {/* FLF-318: dự án tạo SRS đã chốt — bản gốc 1.0 là bản Lead ký, không có file upload */}
                    {v.kind === "imported" && release && !v.has_original_file ? L.signedBaseline() : L.versionKind(v.kind)}
                  </span>
                  <span className="ml-auto text-caption text-[#A8A49C]">{L.formatDateTime(v.created_at)}</span>
                </div>
                {v.cr_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1 text-caption">
                    {v.cr_ids.map((id) => (
                      <Link key={id} href={crHref(projectId, id)} scroll={false} className="px-1.5 py-0.5 rounded bg-[#F0EEEA] text-[#4B4842] font-semibold hover:bg-[#E4E1DC]">
                        {id}
                      </Link>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => void download(v.version, "auto")}
                    disabled={busy !== null}
                    className="px-2.5 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-body font-bold text-[#191817] hover:bg-[#FAF9F7] disabled:opacity-50"
                  >
                    {busy === `download:${v.version}:auto:docx`
                      ? t("downloading")
                      : release
                        ? t("downloadClean")
                        : v.kind === "imported"
                          ? v.has_original_file
                            ? t("downloadRendered")
                            : t("downloadOriginalVersion")
                          : t("downloadDraft")}
                  </button>
                  {/* FLF-316: cùng file ở trên, chuyển sang PDF ở BE — bố cục y hệt bản Word */}
                  <button
                    type="button"
                    onClick={() => void download(v.version, "auto", "pdf")}
                    disabled={busy !== null}
                    title={t("downloadPdfTitle")}
                    className="px-2.5 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-body font-semibold text-[#6B6862] hover:bg-[#FAF9F7] disabled:opacity-50"
                  >
                    {busy === `download:${v.version}:auto:pdf` ? t("creatingPdf") : t("downloadPdf")}
                  </button>
                  {v.has_original_file && (
                    <button
                      type="button"
                      onClick={() => void download(v.version, "original")}
                      disabled={busy !== null}
                      title={t("originalFileTitle")}
                      className="px-2.5 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-body font-semibold text-[#6B6862] hover:bg-[#FAF9F7] disabled:opacity-50"
                    >
                      {busy === `download:${v.version}:original:docx` ? t("downloading") : t("downloadOriginalFile")}
                    </button>
                  )}
                  {/* BPMN 3.14 (mode 1 v3): bản có đánh dấu của CR — Track Changes + comment, tác giả là mã CR */}
                  {v.has_tracked_file && (
                    <button
                      type="button"
                      onClick={() => void download(v.version, "tracked")}
                      disabled={busy !== null}
                      title={
                        v.based_on
                          ? t("trackedTitle", { base: v.based_on, authors: v.cr_ids.join(", ") })
                          : t("trackedTitlePrevious", { authors: v.cr_ids.join(", ") })
                      }
                      className="px-2.5 py-1 rounded-[8px] border border-[#DCD8F0] bg-[#F2F1FB] text-body font-bold text-[#554DB0] hover:bg-[#E8E6F7] disabled:opacity-50"
                    >
                      {busy === `download:${v.version}:tracked:docx` ? t("downloading") : t("downloadTracked")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
