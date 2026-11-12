"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import type { CreditEstimate, StructurePreview as Preview } from "@/types/import";
import StructureAbsorb, { StructureAbsorbLoading } from "./structure-absorb";

/**
 * Màn đọc khung khi file còn đang tải / BE đang đọc khung — cùng khung với `StructurePreview` (tên file, tiêu đề, trang tài liệu
 * và các ô) để có kết quả là hiệu ứng cắt mục chạy tiếp tại chỗ, không nhảy bố cục.
 */
export function StructureReading({ fileName }: { fileName: string }) {
  const t = useTranslations("workspace.import.absorb");
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 max-w-[680px]">
        <p className="flex items-center gap-2 text-body min-w-0">
          <span className="w-7 h-7 shrink-0 rounded-inner bg-primary-soft text-primary flex items-center justify-center">
            <Icon name="file" size={15} />
          </span>
          <span className="truncate font-medium text-on-surface" title={fileName}>
            {fileName}
          </span>
        </p>
        <h2 className="flex items-center gap-2.5 text-title font-bold text-on-surface">
          <Icon name="spinner" size={20} className="text-primary animate-spin" />
          {t("readingTitle")}
        </h2>
        <p className="text-body text-on-surface-variant leading-relaxed">{t("readingHint")}</p>
      </header>
      <StructureAbsorbLoading />
    </div>
  );
}

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
  /** Khoá "đã xem hiệu ứng hợp nhất" — theo lần import. */
  playKey?: string;
}

/**
 * Màn đọc khung (business-flow §3.1.2) — kết quả Code đọc khung file **trước khi tốn credit**: câu tóm tắt, bản đồ mục theo thứ
 * tự trong file (Có / Còn trống / Ngoài phạm vi), báo cáo thiếu sót sơ bộ, một dòng credit + nút Bắt đầu. Không hỏi thêm gì:
 * cấu trúc đích đã chốt ở hộp Tạo dự án.
 */
export default function StructurePreview({ fileName, preview, estimate, credits, busy = false, downloading = false, onStart, onDownloadGapReport, onPickAnother, footer, unsureKind = false, playKey = "preview" }: StructurePreviewProps) {
  const t = useTranslations("workspace.import.preview");
  const summary = preview?.summary ?? null;
  const counted = summary ? summary.present + summary.missing : 0;
  const balance = estimate ? (estimate.available_credits ?? credits) : credits;
  const short = !!estimate && balance !== null && balance < estimate.credits;
  const stats = summary
    ? ([
        { key: "missing", count: summary.missing, className: "bg-accent-gold-soft text-accent-gold-text", icon: "error-circle" },
        { key: "outOfScope", count: summary.out_of_scope, className: "bg-surface-container text-on-surface-muted", icon: "archive" },
      ] as const).filter((s) => s.count > 0)
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Đầu trang: tóm tắt bên trái; thẻ số liệu bên phải — cùng lưới với hai cột bên dưới nên thẳng hàng */}
      <header className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-end">
        <div className="flex flex-col gap-2 min-w-0 max-w-[680px]">
          <p className="flex items-center gap-2 text-body min-w-0">
            <span className="w-7 h-7 shrink-0 rounded-inner bg-primary-soft text-primary flex items-center justify-center">
              <Icon name="file" size={15} />
            </span>
            <span className="truncate font-medium text-on-surface" title={fileName}>
              {fileName}
            </span>
            <button type="button" onClick={onPickAnother} disabled={busy} className="shrink-0 text-caption font-bold text-primary hover:underline cursor-pointer disabled:opacity-50">
              {t("pickAnother")}
            </button>
          </p>
          <h2 className="text-title font-bold text-on-surface">{summary ? t(summary.missing === 0 ? `summary.${summary.kind}Full` : `summary.${summary.kind}`, { present: summary.present, total: counted }) : t("summary.legacy")}</h2>
          {/* FLF-411 U1-1: khung mẫu không có phần nào để "đọc" — câu riêng, không hứa đọc phần đã có / bản gốc 0.1 */}
          {preview && summary && (
            <p className="text-body text-on-surface-variant leading-relaxed">
              {t(summary.kind === "template" && preview.resolved_mode !== 1 ? `next.mode${preview.resolved_mode}Template` : `next.mode${preview.resolved_mode}`, { missing: summary.missing })}
            </p>
          )}
        </div>
        {preview && summary && (
          <div className="flex flex-col gap-3 rounded-card bg-surface-container p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="flex items-baseline gap-2 min-w-0">
                <span className="text-metric font-bold text-on-surface tabular-nums">
                  {summary.present}
                  <span className="text-on-surface-muted">/{counted}</span>
                </span>
                <span className="text-body text-on-surface-variant">{t("stats.withContent")}</span>
              </p>
            </div>
            {/* Thanh chia: có nội dung · còn trống · ngoài phạm vi */}
            <span aria-hidden className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-surface-container-high">
              {summary.present > 0 && <span className="h-full bg-success" style={{ flexGrow: summary.present }} />}
              {summary.missing > 0 && <span className="h-full bg-accent-gold" style={{ flexGrow: summary.missing }} />}
              {summary.out_of_scope > 0 && <span className="h-full bg-on-surface/20" style={{ flexGrow: summary.out_of_scope }} />}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {stats.map((st) => (
                <span key={st.key} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 h-7 text-caption font-semibold ${st.className}`}>
                  <Icon name={st.icon} size={12} />
                  {t(`stats.${st.key}`, { count: st.count })}
                </span>
              ))}
              <Button size="sm" variant="ghost" icon="export" onClick={onDownloadGapReport} loading={downloading} className="ml-auto">
                {t("gapReport")}
              </Button>
            </div>
          </div>
        )}
      </header>

      {unsureKind && (
        <p role="status" className="flex items-start gap-2 rounded-card bg-accent-gold-soft px-4 py-3 text-body text-accent-gold-text">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          {t("unsureKind")}
        </p>
      )}

      {preview && <StructureAbsorb sections={preview.sections} playKey={playKey} />}

      {/* Thanh hành động dính đáy vùng cuộn: credit + Bắt đầu luôn trong tầm mắt, không phải cuộn xuống tìm */}
      <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-card bg-surface-container-lowest/95 backdrop-blur px-4 py-3 shadow-[0_10px_32px_-10px_rgba(30,25,60,0.28)]">
        <span className="w-9 h-9 shrink-0 rounded-control bg-primary-soft text-primary flex items-center justify-center">
          <Icon name="savings" size={18} />
        </span>
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
