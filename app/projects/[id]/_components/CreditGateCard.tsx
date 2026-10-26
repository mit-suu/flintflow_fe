"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";

export interface CreditGateLine {
  /** Nhãn đã dịch, vd "Giai đoạn S-2 · 5 bước" hay "Đọc 2 tài liệu đính kèm". */
  label: string;
  credits: number;
}

export interface CreditGateRequest {
  /** Việc sắp chạy hàng loạt, vd "Soạn toàn bộ SRS sau Brief". */
  title: string;
  lines: CreditGateLine[];
  total: number;
  /** Credit khả dụng của ví org; null khi không biết (Viewer, ví chưa có). */
  available: number | null;
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
export default function CreditGateCard({ title, lines, total, available, busy = false, onRun, onCancel }: CreditGateCardProps) {
  const t = useTranslations("workspace.creditGate");
  const short = available !== null && available < total;
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
              <span className="whitespace-nowrap text-on-surface-muted">{t("credits", { credits: line.credits })}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-outline-variant pt-2">
        <span className="text-body font-bold">{t("total", { credits: total })}</span>
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
