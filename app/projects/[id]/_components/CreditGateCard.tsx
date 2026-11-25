"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";

export interface CreditGateLine {
  /** Nhãn đã dịch, vd "Giai đoạn S-2 · 5 bước" hay "Đọc 2 tài liệu đính kèm". */
  label: string;
  credits: number;
  /** Cận trên khi dòng là khoảng (vd vòng màn hình chưa có danh sách màn, FLF-485). */
  creditsMax?: number;
}

export interface CreditGateRequest {
  /** Việc sắp chạy hàng loạt, vd "Soạn toàn bộ SRS sau Brief". */
  title: string;
  lines: CreditGateLine[];
  /** Tổng (cận dưới khi có `totalMax`). */
  total: number;
  /** Cận trên của tổng; lớn hơn `total` ⇒ hiện khoảng. */
  totalMax?: number;
  /** Không có số ước tính (gọi ước tính lỗi): ẩn dòng tổng và cảnh báo thiếu số dư. */
  totalUnknown?: boolean;
  /** Credit khả dụng của ví org; null khi không biết (Viewer, ví chưa có). */
  available: number | null;
  /** Lưu ý trước khi chạy (đã dịch), vd cảnh báo PDF khi đính kèm (FLF-449). */
  notes?: string[];
}

interface CreditGateCardProps extends CreditGateRequest {
  busy?: boolean;
  onRun: () => void;
  onCancel: () => void;
}

/**
 * Thẻ xác nhận credit — cổng cứng ở mọi mức duyệt (business-flow §1.2, §2 "Báo trước khi chạy hàng loạt", FLF-332):
 * trước khi AI chạy nhiều bước liền (soạn phần còn thiếu sau Approve Brief, rà soát hàng loạt, đọc tài liệu tham khảo)
 * hiện số credit ước tính và số dư; **người dùng bấm Chạy mới gọi AI**, Huỷ thì không trừ credit, tiến độ giữ nguyên.
 * Component độc lập, nhận dữ liệu qua props để agent (đợt sau) hiện lại trong chat.
 */
export default function CreditGateCard({ title, lines, total, totalMax, totalUnknown = false, available, notes = [], busy = false, onRun, onCancel }: CreditGateCardProps) {
  const t = useTranslations("workspace.creditGate");
  const ranged = totalMax !== undefined && totalMax > total;
  const short = !totalUnknown && available !== null && available < total;
  // Đủ cho cận dưới nhưng có thể thiếu nếu ra cận trên (nhiều màn): cảnh báo vàng, không chặn
  const mayShort = !totalUnknown && !short && ranged && available !== null && available < totalMax;
  return (
    <section role="dialog" aria-label={t("aria")} className="rounded-control border border-outline-variant bg-surface-container-lowest p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <Icon name="savings" size={20} />
        <div className="flex-1 min-w-0">
          <h3 className="text-body font-extrabold text-on-surface">{title}</h3>
          <p className="text-caption text-on-surface-muted">{t("intro")}</p>
        </div>
      </div>
      {lines.length > 0 && (
        <ul className="flex flex-col gap-1 text-body" aria-label={t("linesAria")}>
          {lines.map((line) => (
            <li key={line.label} className="flex justify-between gap-3">
              <span className="truncate">{line.label}</span>
              <span className="whitespace-nowrap text-on-surface-muted">{line.creditsMax !== undefined && line.creditsMax > line.credits ? t("creditsRange", { min: line.credits, max: line.creditsMax }) : t("credits", { credits: line.credits })}</span>
            </li>
          ))}
        </ul>
      )}
      {notes.map((note) => (
        <p key={note} role="note" className="flex items-start gap-2 rounded-inner bg-accent-gold-soft px-3 py-2 text-caption leading-relaxed text-on-surface">
          <Icon name="warning" size={14} className="shrink-0 mt-0.5 text-accent-gold-text" />
          <span>{note}</span>
        </p>
      ))}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-outline-variant pt-2">
        {!totalUnknown && <span className="text-body font-bold">{ranged ? t("totalRange", { min: total, max: totalMax }) : t("total", { credits: total })}</span>}
        {available !== null && <span className={`text-caption ${short ? "text-error font-bold" : "text-on-surface-muted"}`}>{t("available", { credits: available })}</span>}
      </div>
      {short && (
        <p role="status" className="text-body text-error">
          {t("short")}{" "}
          <Link href="/home/billing" className="underline font-bold">
            {t("topUp")}
          </Link>
        </p>
      )}
      {mayShort && (
        <p role="status" className="text-body text-accent-gold-text">
          {t("shortRange")}{" "}
          <Link href="/home/billing" className="underline font-bold">
            {t("topUp")}
          </Link>
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="px-3 py-1.5 rounded-full text-body font-bold border border-outline-variant text-on-surface cursor-pointer disabled:opacity-50">
          {t("cancel")}
        </button>
        <button type="button" onClick={onRun} disabled={busy} className="px-3 py-1.5 rounded-full text-body font-bold btn-gradient-primary text-white cursor-pointer disabled:opacity-50">
          {busy ? t("running") : t("run")}
        </button>
      </div>
    </section>
  );
}
