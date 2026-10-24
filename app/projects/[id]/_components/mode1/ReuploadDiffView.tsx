"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { reuploadDocument } from "@/lib/api/import";
import type { ReuploadDiff } from "@/types/import";
import BlockDiffList, { DiffSummary } from "./BlockDiffList";
import { useMode1Labels, type Mode1Labels } from "./i18n";
import { crPrefillHref } from "./prefill";
import UploadStep from "./UploadStep";

/** Mô tả CR điền sẵn từ khác biệt re-upload — người dùng sửa lại trước khi gửi. */
export const reuploadPrefill = (diff: ReuploadDiff, { t }: Pick<Mode1Labels, "t">) => ({
  title: t("reupload.prefillTitle", { name: diff.original_name }),
  description: [
    t("reupload.prefillIntro", { name: diff.original_name, version: diff.against_version }),
    ...diff.blocks.map((b) =>
      b.change === "added"
        ? t("reupload.lineAdded", { after: b.after ?? "" })
        : b.change === "removed"
          ? t("reupload.lineRemoved", { before: b.before ?? "" })
          : b.change === "moved"
            ? (b.before ?? b.after)
              ? t("reupload.lineMoved", { text: b.before ?? b.after ?? "" })
              : t("reupload.lineMovedBlock")
            : t("reupload.lineChanged", { before: b.before ?? "", after: b.after ?? "" })
    ),
  ].join("\n"),
});

/**
 * 1.4 Re-upload (UC-24): file mang stamp của chính dự án (đã sửa ngoài FlintFlow) ⇒ so theo block với version
 * mới nhất. **Không tạo version** — muốn áp thì tạo change request từ khác biệt.
 */
export default function ReuploadDiffView({ projectId }: { projectId: string }) {
  const t = useTranslations("mode1.reupload");
  const L = useMode1Labels();
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
      setError(L.errorText(err, t("failed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <UploadStep busy={busy} onUpload={(file) => void upload(file)} title={t("title")} hint={t("hint")} />
      {error && (
        <p role="alert" className="text-body text-[#B03030] bg-[#FDEDED] border border-[#F2CACA] rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}
      {diff && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-body text-[#4B4842]">
              {t.rich("summary", {
                name: () => <strong>{diff.original_name}</strong>,
                version: diff.against_version,
                at: L.formatDateTime(diff.created_at),
                summary: () => <DiffSummary summary={diff.summary} />,
              })}
            </p>
            {diff.blocks.length > 0 && (
              <Link
                href={crPrefillHref(projectId, { ...reuploadPrefill(diff, L), source: "reupload", ref: t("prefillRef", { name: diff.original_name }) })}
                className="px-3 py-1.5 rounded-[8px] btn-gradient-primary text-white text-body font-bold"
              >
                {t("createCr")}
              </Link>
            )}
          </div>
          <BlockDiffList entries={diff.blocks} />
        </div>
      )}
    </div>
  );
}
