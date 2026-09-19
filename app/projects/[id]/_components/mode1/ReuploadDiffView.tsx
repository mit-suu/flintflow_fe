"use client";

import Link from "next/link";
import { useState } from "react";
import { reuploadDocument } from "@/lib/api/import";
import type { ReuploadDiff } from "@/types/import";
import BlockDiffList, { summaryText } from "./BlockDiffList";
import { errorText } from "./errors";
import { formatDateTime } from "./labels";
import { crPrefillHref } from "./prefill";
import UploadStep from "./UploadStep";

/** Mô tả CR điền sẵn từ khác biệt re-upload — người dùng sửa lại trước khi gửi. */
export const reuploadPrefill = (diff: ReuploadDiff) => ({
  title: `Cập nhật theo file ${diff.original_name}`,
  description: [
    `Áp các thay đổi trong file tải lại ${diff.original_name} (so với bản ${diff.against_version}):`,
    ...diff.blocks.map((b) =>
      b.change === "added"
        ? `- Thêm: ${b.after ?? ""}`
        : b.change === "removed"
          ? `- Xoá ${b.block_id}: ${b.before ?? ""}`
          : b.change === "moved"
            ? `- Di chuyển ${b.block_id}`
            : `- Sửa ${b.block_id}: "${b.before ?? ""}" → "${b.after ?? ""}"`
    ),
  ].join("\n"),
});

/**
 * 1.4 Re-upload (UC-24): file mang stamp của chính dự án (đã sửa ngoài FlintFlow) ⇒ so theo block với version
 * mới nhất. **Không tạo version** — muốn áp thì tạo change request từ khác biệt.
 */
export default function ReuploadDiffView({ projectId }: { projectId: string }) {
  const [diff, setDiff] = useState<ReuploadDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      setDiff((await reuploadDocument(projectId, file)).data);
    } catch (err) {
      setDiff(null);
      setError(errorText(err, "Không so được file"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <UploadStep
        busy={busy}
        onUpload={(file) => void upload(file)}
        title="Tải lên bản đã sửa ngoài FlintFlow"
        hint="So theo block với version mới nhất, không tạo version mới. Muốn áp thay đổi thì tạo change request từ khác biệt."
      />
      {error && (
        <p role="alert" className="text-[12.5px] text-[#B03030] bg-[#FDEDED] border border-[#F2CACA] rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}
      {diff && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-[12.5px] text-[#4B4842]">
              <strong>{diff.original_name}</strong> so với bản {diff.against_version} ({formatDateTime(diff.created_at)}): {summaryText(diff.summary)}
            </p>
            {diff.blocks.length > 0 && (
              <Link
                href={crPrefillHref(projectId, { ...reuploadPrefill(diff), source: "reupload", ref: diff.id })}
                className="px-3 py-1.5 rounded-[8px] btn-gradient-primary text-white text-[12px] font-bold"
              >
                Tạo CR từ khác biệt
              </Link>
            )}
          </div>
          <BlockDiffList entries={diff.blocks} />
        </div>
      )}
    </div>
  );
}
