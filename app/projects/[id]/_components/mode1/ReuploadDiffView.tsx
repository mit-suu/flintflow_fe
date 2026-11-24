"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { takePendingReupload } from "./pending-reupload";
import { useTranslations } from "next-intl";
import { reuploadDocument } from "@/lib/api/import";
import type { BlockDiffEntry, ReuploadDiff, ReuploadMarkup } from "@/types/import";
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

/** FLF-457: một dòng cho chỗ Track Changes / comment của người ngoài. */
export const markupLine = (m: ReuploadMarkup, t: Translate): string => {
  const author = m.author || t("reupload.unknownAuthor");
  if (m.kind === "comment") return t("reupload.markupComment", { author, text: m.text });
  return m.change === "format" ? t("reupload.markupTrackFormat", { author }) : t("reupload.markupTrackText", { author, text: m.text });
};

/** Một chỗ khác biệt người dùng chọn nhận được (trước baseline): mục chứa nó + các dòng mô tả. */
export interface ReuploadItem {
  key: string;
  section?: string;
  sectionKey?: string;
  lines: string[];
}

/** Mọi chỗ khác biệt theo thứ tự tài liệu, rồi tới Track Changes / comment của người ngoài (mỗi chỗ một mục). */
export const reuploadItems = (diff: ReuploadDiff, { t }: Pick<Mode1Labels, "t">): ReuploadItem[] => [
  ...diff.blocks.map((b, i) => ({
    key: `b${i}`,
    section: b.section || undefined,
    sectionKey: b.section ? (b.section_key ?? b.section) : undefined,
    lines: b.table ? tableLines(b, t) : [blockLine(b, t)],
  })),
  ...(diff.markup ?? []).map((m, i) => ({ key: `m${i}`, section: m.section || undefined, sectionKey: m.section || undefined, lines: [`- ${markupLine(m, t)}`] })),
];

/** Các dòng của những mục đã chọn; tiêu đề mục in một lần mỗi khi sang mục khác (khoá = đường heading). */
const itemLines = (items: ReuploadItem[], { t }: Pick<Mode1Labels, "t">): string[] => {
  const lines: string[] = [];
  let sectionKey: string | undefined;
  for (const item of items) {
    if (item.section && item.sectionKey !== sectionKey) lines.push(t("reupload.lineSection", { section: item.section }));
    if (item.sectionKey) sectionKey = item.sectionKey;
    lines.push(...item.lines);
  }
  return lines;
};

/**
 * Mô tả CR điền sẵn từ khác biệt re-upload, theo mục và theo hàng của bảng, người dùng sửa lại trước khi gửi. Bản ghi cũ (không có
 * mục) giữ kiểu mỗi khối một dòng. FLF-457: kèm mỗi chỗ Track Changes / comment của người ngoài một dòng.
 */
export const reuploadPrefill = (diff: ReuploadDiff, labels: Pick<Mode1Labels, "t">) => {
  const { t } = labels;
  return {
    title: t("reupload.prefillTitle", { name: diff.original_name }),
    description: [t("reupload.prefillIntro", { name: diff.original_name, version: diff.against_version }), ...itemLines(reuploadItems(diff, labels), labels)].join("\n"),
  };
};

/** FLF-457, trước baseline: lệnh sửa gửi vào chat cho những chỗ đã chọn (đi bản xem trước như mọi lệnh sửa). */
export const reuploadChatInstruction = (diff: ReuploadDiff, keys: ReadonlySet<string>, labels: Pick<Mode1Labels, "t">): string =>
  [labels.t("reupload.prefillIntroDraft", { name: diff.original_name }), ...itemLines(reuploadItems(diff, labels).filter((i) => keys.has(i.key)), labels)].join("\n");

/**
 * 1.3a Upload lại (UC-24): so theo block với bản đang có. **Không tạo version.**
 * - Sau baseline: so với version mới nhất; muốn áp thì tạo change request từ khác biệt.
 * - FLF-457, trước baseline (`before_baseline`): so với nội dung đang soạn; chọn những chỗ muốn nhận rồi gửi thành lệnh sửa qua
 *   chat (`onApplyViaChat`, đi bản xem trước như mọi lệnh sửa).
 * - FLF-457: file không dấu version, bản cũ hơn bản hiện tại, Track Changes / comment của người ngoài hiện thành cảnh báo / dòng
 *   riêng; nút Lưu làm tham khảo (`onSaveAsReference`) đưa file vào kho tài liệu tham khảo.
 */
export default function ReuploadDiffView({
  projectId,
  beforeBaseline = false,
  onApplyViaChat,
  onSaveAsReference,
}: {
  projectId: string;
  /** Dự án chưa có baseline (đang soạn): chỉ đổi câu hướng dẫn trước khi có kết quả; kết quả theo `diff.before_baseline`. */
  beforeBaseline?: boolean;
  onApplyViaChat?: (instruction: string) => void;
  onSaveAsReference?: (file: File) => void;
}) {
  const t = useTranslations("mode1.reupload");
  const L = useMode1Labels();
  const [diff, setDiff] = useState<ReuploadDiff | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Trước baseline: các chỗ đang chọn để sửa qua chat (mặc định chọn hết). */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // File vừa đính kèm trong chat + chọn "Cập nhật phiên bản mới" ⇒ so luôn, không bắt chọn lại (lấy một lần)
  const [handoff] = useState(takePendingReupload);
  const handoffSent = useRef(false);
  const [handoffDone, setHandoffDone] = useState(false);

  const show = (next: ReuploadDiff | null, source: File) => {
    setDiff(next);
    if (!next) return;
    setFile(source);
    setPicked(new Set(reuploadItems(next, L).map((i) => i.key)));
  };

  const upload = async (chosen: File) => {
    setBusy(true);
    setError(null);
    try {
      show((await reuploadDocument(projectId, chosen)).data, chosen);
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
      .then((res) => show(res.data, handoff))
      .catch((err: unknown) => setError(L.errorText(err, t("failed"))))
      .finally(() => setHandoffDone(true));
    // Chỉ chạy một lần cho file được chuyển sang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff]);

  const items = diff ? reuploadItems(diff, L) : [];
  const draft = diff?.before_baseline === true;
  const markup = diff?.markup ?? [];
  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const saveButton = (label: string) =>
    onSaveAsReference && file ? (
      <button
        type="button"
        onClick={() => onSaveAsReference(file)}
        className="px-3 py-1.5 rounded-[8px] border border-[#D9D4CA] text-body font-bold text-[#4B4842] hover:bg-[#F6F3EE]"
      >
        {label}
      </button>
    ) : null;
  const notice = "text-body text-[#7A5B12] bg-[#FFF6E0] border border-[#F1DFA8] rounded-[10px] px-3 py-2";

  return (
    <div className="flex flex-col gap-3">
      <UploadStep busy={busy || (!!handoff && !handoffDone)} onUpload={(f) => void upload(f)} title={t("title")} hint={beforeBaseline ? t("hintDraft") : t("hint")} />
      {error && (
        <p role="alert" className="text-body text-[#B03030] bg-[#FDEDED] border border-[#F2CACA] rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}
      {diff && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-body text-[#4B4842]">
              {t.rich(draft ? "summaryDraft" : "summary", {
                name: () => <strong>{diff.original_name}</strong>,
                version: diff.against_version,
                at: L.formatDateTime(diff.created_at),
                summary: () => <DiffSummary summary={diff.summary} />,
              })}
            </p>
            {saveButton(t("saveAsReference"))}
            {!draft && items.length > 0 && (
              <Link
                href={crPrefillHref(projectId, { ...reuploadPrefill(diff, L), source: "reupload", ref: t("prefillRef", { name: diff.original_name }) })}
                className="px-3 py-1.5 rounded-[8px] btn-gradient-primary text-white text-body font-bold"
              >
                {t("createCr")}
              </Link>
            )}
          </div>
          {diff.no_stamp && (
            <p role="status" className={notice}>
              {t("noStamp")}
            </p>
          )}
          {diff.suggest_reference && (
            <div role="status" className={`flex flex-wrap items-center gap-3 ${notice}`}>
              <span className="flex-1">{t("suggestReference", { percent: Math.round((diff.heading_match ?? 0) * 100) })}</span>
              {saveButton(t("useAsReference"))}
            </div>
          )}
          {diff.stale && (
            <p role="status" className={notice}>
              {t("stale", { file: diff.stale.file_version, current: diff.stale.current_version })}
            </p>
          )}
          {markup.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-body font-bold text-[#2B2925]">{t("markupTitle", { count: markup.length })}</h3>
              <ul className="flex flex-col gap-1.5">
                {markup.map((m, i) => (
                  <li key={i} className="rounded-[8px] border border-[#ECE7DE] px-3 py-2 text-body text-[#4B4842]">
                    <p>{markupLine(m, L.t)}</p>
                    {m.location?.text && <p className="text-caption text-[#8A857C]">{t("markupAt", { text: m.location.text })}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {draft && onApplyViaChat && items.length > 0 && (
            <section className="flex flex-col gap-2 rounded-[10px] border border-[#ECE7DE] px-3 py-2">
              <h3 className="text-body font-bold text-[#2B2925]">{t("applyTitle")}</h3>
              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <li key={item.key}>
                    <label className="flex items-start gap-2 text-body text-[#4B4842]">
                      <input type="checkbox" className="mt-1" checked={picked.has(item.key)} onChange={() => toggle(item.key)} />
                      <span className="whitespace-pre-line">{[item.section, ...item.lines].filter(Boolean).join("\n")}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={picked.size === 0}
                onClick={() => onApplyViaChat(reuploadChatInstruction(diff, picked, L))}
                className="self-start px-3 py-1.5 rounded-[8px] btn-gradient-primary text-white text-body font-bold disabled:opacity-50"
              >
                {t("applyViaChat", { count: picked.size })}
              </button>
            </section>
          )}
          <VersionDiffView entries={diff.blocks} sections={diff.sections} fromLabel={diff.against_version} toLabel={diff.original_name} />
        </div>
      )}
    </div>
  );
}
