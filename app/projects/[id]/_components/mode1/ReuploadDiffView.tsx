"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { takePendingReupload } from "./pending-reupload";
import { useTranslations } from "next-intl";
import { reuploadDocument } from "@/lib/api/import";
import type { BlockDiffEntry, ReuploadDiff } from "@/types/import";
import VersionDiffView, { DiffSummary } from "./VersionDiffView";
import { useMode1Labels, type Mode1Labels } from "./i18n";
import { crPrefillHref } from "./prefill";
import UploadStep from "./UploadStep";

type Translate = Pick<Mode1Labels, "t">["t"];

/** Một dòng mô tả cho đoạn (không phải bảng). */
const blockLine = (b: BlockDiffEntry, t: Translate): string =>
  b.change === "added"
    ? t("reupload.lineAdded", { after: b.after ?? "" })
    : b.change === "removed"
      ? t("reupload.lineRemoved", { before: b.before ?? "" })
      : b.change === "moved"
        ? (b.before ?? b.after)
          ? t("reupload.lineMoved", { text: b.before ?? b.after ?? "" })
          : t("reupload.lineMovedBlock")
        : t("reupload.lineChanged", { before: b.before ?? "", after: b.after ?? "" });

const rowText = (cells?: string[]): string => (cells ?? []).map((c) => c.trim()).join(" | ");

/** Bảng sửa theo hàng ⇒ mỗi loại thay đổi một dòng ("Thêm 3 hàng: …"), không dán nguyên bảng. */
const tableLines = (b: BlockDiffEntry, t: Translate): string[] => {
  const rows = b.table?.rows ?? [];
  const of = (change: string) => rows.filter((r) => r.change === change) as { before?: string[]; after?: string[] }[];
  const added = of("added");
  const removed = of("removed");
  const changed = of("modified");
  const moved = of("moved");
  return [
    ...(added.length ? [t("reupload.lineRowsAdded", { count: added.length, rows: added.map((r) => rowText(r.after)).join("; ") })] : []),
    ...(removed.length ? [t("reupload.lineRowsRemoved", { count: removed.length, rows: removed.map((r) => `"${rowText(r.before)}"`).join("; ") })] : []),
    ...(changed.length ? [t("reupload.lineRowsChanged", { count: changed.length, rows: changed.map((r) => `"${rowText(r.before)}" → "${rowText(r.after)}"`).join("; ") })] : []),
    ...(moved.length ? [t("reupload.lineRowsMoved", { count: moved.length })] : []),
  ];
};

/**
 * Mô tả CR điền sẵn từ khác biệt re-upload, theo mục và theo hàng của bảng — người dùng sửa lại trước khi gửi. Bản ghi cũ (không có
 * mục) giữ kiểu mỗi khối một dòng.
 */
export const reuploadPrefill = (diff: ReuploadDiff, { t }: Pick<Mode1Labels, "t">) => {
  const lines: string[] = [];
  let sectionKey: string | undefined;
  for (const b of diff.blocks) {
    // Tiêu đề mục in một lần mỗi khi sang mục khác (khoá = đường heading, mục trùng tên ở hai chỗ vẫn tách)
    const key = b.section ? (b.section_key ?? b.section) : undefined;
    if (b.section && key !== sectionKey) lines.push(t("reupload.lineSection", { section: b.section }));
    if (key) sectionKey = key;
    lines.push(...(b.table ? tableLines(b, t) : [blockLine(b, t)]));
  }
  return {
    title: t("reupload.prefillTitle", { name: diff.original_name }),
    description: [t("reupload.prefillIntro", { name: diff.original_name, version: diff.against_version }), ...lines].join("\n"),
  };
};

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
  // File vừa đính kèm trong chat + chọn "Cập nhật phiên bản mới" ⇒ so luôn, không bắt chọn lại (lấy một lần)
  const [handoff] = useState(takePendingReupload);
  const handoffSent = useRef(false);
  const [handoffDone, setHandoffDone] = useState(false);

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

  useEffect(() => {
    if (!handoff || handoffSent.current) return;
    handoffSent.current = true;
    reuploadDocument(projectId, handoff)
      .then((res) => setDiff(res.data))
      .catch((err: unknown) => setError(L.errorText(err, t("failed"))))
      .finally(() => setHandoffDone(true));
    // Chỉ chạy một lần cho file được chuyển sang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff]);

  return (
    <div className="flex flex-col gap-3">
      <UploadStep busy={busy || (!!handoff && !handoffDone)} onUpload={(file) => void upload(file)} title={t("title")} hint={t("hint")} />
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
          <VersionDiffView entries={diff.blocks} sections={diff.sections} fromLabel={diff.against_version} toLabel={diff.original_name} />
        </div>
      )}
    </div>
  );
}
