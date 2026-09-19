"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { saveBlob } from "@/lib/api/files";
import { getSpine } from "@/lib/api/spine";
import { downloadVersion, releaseDocument } from "@/lib/api/versions";
import { isReleaseVersion, type DocVersion, type DownloadVariant } from "@/types/doc-version";
import type { Flag } from "@/types/spine";
import { errorText } from "./errors";
import { VERSION_KIND_LABELS, formatDateTime } from "./labels";

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
}

/**
 * Version & release (Flow 6, UC-57): `0.0` import → `0.x` sau mỗi CR (Track Changes + DRAFT) → `x.0` release
 * (bản sạch). Release bị khoá khi còn cờ đỏ (BR-04, mode 1 không waive) — BE vẫn chặn lần nữa.
 */
export default function VersionsPanel({ projectId, projectName, versions, redOpen, selected, onSelect, onReleased }: VersionsPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockingFlags, setBlockingFlags] = useState<Flag[]>([]);

  const latest = versions[0] ?? null;
  const alreadyReleased = latest ? isReleaseVersion(latest.version) : false;
  const releaseBlockedReason =
    redOpen === null
      ? "Đang kiểm cờ…"
      : redOpen > 0
        ? `Còn ${redOpen} cờ đỏ — xử lý qua change request trước khi release.`
        : !latest
          ? "Chưa có tài liệu."
          : null;

  const download = async (version: string, variant: DownloadVariant) => {
    setBusy(`download:${version}:${variant}`);
    setError(null);
    try {
      const { blob, filename } = await downloadVersion(projectId, version, variant);
      const suffix = variant === "original" ? "_original" : isReleaseVersion(version) && variant === "auto" ? "" : "_DRAFT";
      saveBlob(blob, filename ?? `${projectName ?? "SRS"}_v${version}${suffix}.docx`);
    } catch (err) {
      setError(errorText(err, "Không tải được file"));
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
      setError(errorText(err, "Release không thành công"));
      if (err instanceof ApiClientError && err.code === "RELEASE_RED_FLAGS_OPEN") setBlockingFlags((err.meta?.flags as Flag[] | undefined) ?? []);
      if (err instanceof ApiClientError && err.code === "SPINE_VERSION_CONFLICT") onReleased();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h3 className="font-extrabold text-[#191817] text-[13.5px]">Release</h3>
        <p className="text-[11.5px] text-[#8A867E] leading-relaxed">
          Đóng dấu bản major tiếp theo, khoá baseline và tạo bản sạch (đã Accept mọi Track Changes). Gom mọi change request đã ghi từ
          lần release trước.
        </p>
        {confirming ? (
          <div className="flex flex-col gap-2 bg-[#F4F3FE] border border-[#DDD9F6] rounded-[10px] p-3 text-[12px] text-[#3B34B0]">
            <p>Release từ bản {latest?.version}? Sau khi release, sửa tiếp phải qua change request mới.</p>
            {alreadyReleased && <p className="text-[#8A6D1F]">Bản mới nhất đã là bản release và chưa có change request nào ghi sau đó — release lại chỉ đóng số mới.</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirming(false)} disabled={busy === "release"} className="px-3 py-1 rounded-[8px] border border-[#DDD9F6] bg-white font-semibold">
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => void release()}
                disabled={busy === "release"}
                className="px-3 py-1 rounded-[8px] bg-[#4F46E5] text-white font-bold disabled:opacity-50"
              >
                {busy === "release" ? "Đang release…" : "Xác nhận release"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={releaseBlockedReason !== null}
            title={releaseBlockedReason ?? undefined}
            className="px-4 py-2 rounded-[10px] btn-gradient-primary text-white text-[12.5px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Release
          </button>
        )}
        {releaseBlockedReason && !confirming && <p className="text-[11.5px] text-[#8A6D1F]">{releaseBlockedReason}</p>}
        {error && (
          <div role="alert" className="text-[12px] text-[#B03030] bg-[#FDEDED] border border-[#F2CACA] rounded-[10px] px-3 py-2">
            {error}
            {blockingFlags.length > 0 && (
              <ul className="list-disc pl-4 mt-1">
                {blockingFlags.map((f) => (
                  <li key={f.id}>{f.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-extrabold text-[#191817] text-[13.5px]">Các version</h3>
        <ul className="flex flex-col gap-2">
          {versions.map((v) => {
            const release = isReleaseVersion(v.version);
            return (
              <li
                key={v.version}
                className={`rounded-[12px] border px-3 py-2.5 flex flex-col gap-1.5 ${selected === v.version ? "border-[#4F46E5] bg-[#F4F3FE]" : "border-[#ECEAE5] bg-white"}`}
              >
                <div className="flex items-center gap-2">
                  {onSelect ? (
                    <button type="button" onClick={() => onSelect(v.version)} className="font-extrabold text-[#191817] text-[14px] hover:underline" aria-label={`Xem bản ${v.version}`}>
                      {v.version}
                    </button>
                  ) : (
                    <span className="font-extrabold text-[#191817] text-[14px]">{v.version}</span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                      release ? "bg-[#E9F7EE] text-[#1F7A45]" : v.kind === "imported" ? "bg-[#F0EEEA] text-[#4B4842]" : "bg-[#FBF4E4] text-[#8A6D1F]"
                    }`}
                  >
                    {VERSION_KIND_LABELS[v.kind]}
                  </span>
                  <span className="ml-auto text-[10.5px] text-[#A8A49C]">{formatDateTime(v.created_at)}</span>
                </div>
                {v.cr_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1 text-[11px]">
                    {v.cr_ids.map((id) => (
                      <Link key={id} href={`/projects/${projectId}/change-requests/${id}`} className="px-1.5 py-0.5 rounded bg-[#F0EEEA] text-[#4B4842] font-semibold hover:bg-[#E4E1DC]">
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
                    className="px-2.5 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-[11.5px] font-bold text-[#191817] hover:bg-[#FAF9F7] disabled:opacity-50"
                  >
                    {busy === `download:${v.version}:auto` ? "Đang tải…" : release ? "Tải bản sạch" : v.kind === "imported" ? (v.has_original_file ? "Tải bản render (DRAFT)" : "Tải bản gốc") : "Tải bản draft (Track Changes)"}
                  </button>
                  {v.has_original_file && (
                    <button
                      type="button"
                      onClick={() => void download(v.version, "original")}
                      disabled={busy !== null}
                      title="File .docx người dùng upload lúc import"
                      className="px-2.5 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-[11.5px] font-semibold text-[#6B6862] hover:bg-[#FAF9F7] disabled:opacity-50"
                    >
                      {busy === `download:${v.version}:original` ? "Đang tải…" : "Tải file gốc"}
                    </button>
                  )}
                  {release && (
                    <button
                      type="button"
                      onClick={() => void download(v.version, "tracked")}
                      disabled={busy !== null}
                      className="px-2.5 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-[11.5px] font-semibold text-[#6B6862] hover:bg-[#FAF9F7] disabled:opacity-50"
                    >
                      {busy === `download:${v.version}:tracked` ? "Đang tải…" : "Bản có Track Changes"}
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
