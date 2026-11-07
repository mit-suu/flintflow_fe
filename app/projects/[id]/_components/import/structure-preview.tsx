"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import type { CreditEstimate, StructurePreview as Preview, TargetSectionStatus } from "@/types/import";

interface StructurePreviewProps {
  fileName: string;
  /** `null`: import trước màn đọc khung (chưa có bản sơ bộ) — chỉ còn dòng credit + Bắt đầu. */
  preview: Preview | null;
  /** Ước tính cả lượt (đọc nội dung + kiểm tra) do BE tính; `null` khi BE chưa có. */
  estimate: CreditEstimate | null;
  /** Số dư header — dùng khi BE không trả `available_credits`. */
  credits: number | null;
  busy?: boolean;
  downloading?: boolean;
  onStart: () => void;
  onDownloadGapReport: () => void;
  onPickAnother: () => void;
  /** Thẻ "Lưu làm mẫu tổ chức" (file giữ khung). */
  footer?: React.ReactNode;
  /** Preflight chưa chắc file là SRS (`document_kind = unknown`) — vẫn cho đi tiếp, nhắc xem kỹ. */
  unsureKind?: boolean;
}

const STATUS_ICON: Record<TargetSectionStatus, { icon: IconName; className: string }> = {
  present: { icon: "check-circle", className: "text-success" },
  missing: { icon: "error-circle", className: "text-accent-gold-text" },
  out_of_scope: { icon: "archive", className: "text-on-surface-muted" },
};

/**
 * Màn đọc khung (business-flow §3.1.2) — kết quả Code đọc khung file **trước khi tốn credit**: câu tóm tắt, bản đồ mục theo thứ
 * tự trong file (Có / Còn trống / Ngoài phạm vi), báo cáo thiếu sót sơ bộ, một dòng credit + nút Bắt đầu. Không hỏi thêm gì:
 * cấu trúc đích đã chốt ở hộp Tạo dự án.
 */
export default function StructurePreview({ fileName, preview, estimate, credits, busy = false, downloading = false, onStart, onDownloadGapReport, onPickAnother, footer, unsureKind = false }: StructurePreviewProps) {
  const t = useTranslations("workspace.import.preview");
  const summary = preview?.summary ?? null;
  const counted = summary ? summary.present + summary.missing : 0;
  const balance = estimate ? (estimate.available_credits ?? credits) : credits;
  const short = !!estimate && balance !== null && balance < estimate.credits;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <p className="flex items-center gap-2 text-body text-on-surface-muted min-w-0">
          <Icon name="file" size={16} className="shrink-0" />
          <span className="truncate" title={fileName}>
            {fileName}
          </span>
          <button type="button" onClick={onPickAnother} disabled={busy} className="shrink-0 text-caption font-bold text-primary hover:underline cursor-pointer disabled:opacity-50">
            {t("pickAnother")}
          </button>
        </p>
        <h2 className="text-heading font-bold text-on-surface">{summary ? t(`summary.${summary.kind}`, { present: summary.present, total: counted }) : t("summary.legacy")}</h2>
        {preview && summary && <p className="text-body text-on-surface-variant leading-relaxed">{t(`next.mode${preview.resolved_mode}`, { missing: summary.missing })}</p>}
      </header>

      {unsureKind && (
        <p role="status" className="flex items-start gap-2 rounded-card bg-accent-gold-soft px-4 py-3 text-body text-accent-gold-text">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          {t("unsureKind")}
        </p>
      )}

      {preview && (
      <section aria-labelledby="structure-map-title" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 id="structure-map-title" className="text-body font-bold text-on-surface-medium">
            {t("mapTitle")}
          </h3>
          <Button size="sm" variant="ghost" icon="export" onClick={onDownloadGapReport} loading={downloading}>
            {t("gapReport")}
          </Button>
        </div>
        <ol className="flex flex-col rounded-card bg-surface-container overflow-hidden">
          {preview.sections.map((section) => {
            const look = STATUS_ICON[section.status];
            return (
              <li key={section.section_id} className="flex items-start gap-3 px-4 py-2.5 odd:bg-surface-container even:bg-surface-container-low">
                <Icon name={look.icon} size={16} className={`mt-0.5 shrink-0 ${look.className}`} />
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-body text-on-surface">{section.title}</span>
                  {section.status === "out_of_scope" && <span className="text-caption text-on-surface-muted">{t("outOfScopeNote")}</span>}
                </span>
                <span className="shrink-0 text-caption font-semibold text-on-surface-muted">{t(`status.${section.status}`)}</span>
              </li>
            );
          })}
        </ol>
      </section>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface-container-low px-4 py-3">
        <Icon name="savings" size={18} className="shrink-0 text-primary" />
        <p className="flex-1 min-w-[220px] text-body text-on-surface" role={short ? "alert" : undefined}>
          {estimate
            ? estimate.ai_calls === 0
              ? t("credit.none")
              : t.rich("credit.estimate", { credits: estimate.credits, strong: (c) => <strong>{c}</strong> })
            : t("credit.unknown")}
          {balance !== null && <span className="text-on-surface-muted"> · {t("credit.balance", { balance })}</span>}
          {short && (
            <>
              {" "}
              <span className="text-accent-gold-text">{t("credit.short")}</span>{" "}
              <Link href="/home/billing" className="font-bold text-primary underline">
                {t("credit.topUp")}
              </Link>
            </>
          )}
        </p>
        <Button onClick={onStart} disabled={short} loading={busy} iconRight="arrow-right">
          {busy ? t("starting") : t("start")}
        </Button>
      </div>

      {footer}
    </div>
  );
}
