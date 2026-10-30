"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CreditEstimate, ImportedDocument } from "@/types/import";
import CreditEstimateNote from "./CreditEstimateNote";

interface StartImportCardProps {
  doc: ImportedDocument;
  /** Ước tính cả lượt một mạch (I-4 + kiểm tra AI) do BE tính; `null` khi BE chưa có (bản ghi cũ chưa tách file). */
  estimate: CreditEstimate | null;
  /** Số dư header — dùng khi BE không trả `available_credits`. */
  credits: number | null;
  busy?: boolean;
  /** Bấm Bắt đầu: `confirmLatest` = câu trả lời "đây là bản mới nhất". */
  onStart: (confirmLatest: boolean) => void;
  /** Bỏ tick "bản mới nhất" ⇒ chọn file khác. */
  onPickAnother: () => void;
}

/**
 * FLF-343 — điểm dừng duy nhất của chế độ 1: báo credit **một lần** (I-4 + kiểm tra AI) cùng câu hỏi "đây là bản mới nhất"
 * (chỉ khi file chưa xác nhận — mẫu tổ chức / file mang stamp của dự án thì không hỏi). Một nút Bắt đầu; số dư nhỏ hơn ước
 * tính ⇒ khoá nút + gợi ý nạp credit. Bỏ tick ⇒ không chạy, hiện đúng câu từ chối của BE (`IMPORT_NEEDS_LATEST_CONFIRM`).
 */
export default function StartImportCard({ doc, estimate, credits, busy = false, onStart, onPickAnother }: StartImportCardProps) {
  const t = useTranslations("mode1.importWizard.start");
  const tErr = useTranslations("mode1.errors.codes");
  const askLatest = doc.confirmed_latest_at === null;
  const [latest, setLatest] = useState(true);
  const balance = estimate ? (estimate.available_credits ?? credits) : credits;
  const short = !!estimate && balance !== null && balance < estimate.credits;
  const blocked = short || (askLatest && !latest);

  return (
    <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-5 flex flex-col gap-3">
      <h3 className="font-extrabold text-[#191817] text-heading">{t("title")}</h3>
      <p className="text-body text-[#4B4842] leading-relaxed">{t.rich("body", { strong: (c) => <strong>{c}</strong> })}</p>
      {estimate && <CreditEstimateNote estimate={estimate} fallbackBalance={credits} />}
      {askLatest && (
        <label className="flex items-start gap-2 text-body text-[#191817] cursor-pointer">
          <input type="checkbox" checked={latest} onChange={(e) => setLatest(e.target.checked)} disabled={busy} className="mt-1" />
          <span>{t("latest")}</span>
        </label>
      )}
      {askLatest && !latest && (
        <div role="alert" className="flex flex-wrap items-center gap-3 bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-3 py-2 rounded-[10px] text-body">
          <span className="flex-1">{tErr("IMPORT_NEEDS_LATEST_CONFIRM")}</span>
          <button type="button" onClick={onPickAnother} className="font-bold underline">
            {t("pickAnother")}
          </button>
        </div>
      )}
      {short && (
        <p className="text-body text-accent-gold-text">
          {t("shortHint")}{" "}
          <Link href="/home/billing" className="font-bold underline">
            {t("topUp")}
          </Link>
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy || blocked}
          onClick={() => onStart(askLatest && latest)}
          className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-body font-bold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {busy ? t("starting") : t("start")}
        </button>
      </div>
    </div>
  );
}
