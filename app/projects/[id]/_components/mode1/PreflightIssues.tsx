"use client";

import { useTranslations } from "next-intl";
import type { PreflightIssue, PreflightIssueCode } from "@/types/import";
import { useMode1Labels } from "./i18n";

/** Mã có nhãn (`mode1.preflight.codes.<mã>`). */
const CODES: readonly PreflightIssueCode[] = [
  "NOT_DOCX",
  "CORRUPT_ZIP",
  "LEGACY_DOC",
  "FILE_ENCRYPTED",
  "FILE_TOO_LARGE",
  "EMPTY_DOCUMENT",
  "FOREIGN_TRACK_CHANGE",
  "FOREIGN_COMMENT",
];

/** Mã có hướng dẫn sửa (`mode1.preflight.howToFix.<mã>`). */
const HOW_TO_FIX = ["LEGACY_DOC", "FILE_ENCRYPTED", "FOREIGN_TRACK_CHANGE", "FOREIGN_COMMENT", "FILE_TOO_LARGE"] as const satisfies readonly PreflightIssueCode[];
const hasFix = (code: PreflightIssueCode): code is (typeof HOW_TO_FIX)[number] => (HOW_TO_FIX as readonly string[]).includes(code);

/** 1.2 Preflight (I-1): lý do từ chối kèm vị trí trong tài liệu — sửa file rồi tải lại. */
export default function PreflightIssues({ issues, fileName }: { issues: PreflightIssue[]; fileName?: string }) {
  const t = useTranslations("mode1.preflight");
  const L = useMode1Labels();
  if (issues.length === 0) return null;
  return (
    <div role="alert" className="bg-[#FDEDED] border border-[#F2CACA] rounded-[14px] p-4 flex flex-col gap-3">
      <p className="text-body font-bold text-[#8A4141]">
        {fileName ? t("titleNamed", { name: fileName, count: issues.length }) : t("title", { count: issues.length })}
      </p>
      <ul className="flex flex-col gap-2">
        {issues.map((issue, i) => (
          <li key={`${issue.code}-${i}`} className="bg-white border border-[#F2CACA] rounded-[10px] px-3 py-2 text-body">
            <div className="font-bold text-[#B03030]">{CODES.includes(issue.code) ? t(`codes.${issue.code}`) : t("otherIssue")}</div>
            <div className="text-[#4B4842]">{L.humanizeText(issue.message)}</div>
            {issue.location && (
              <div className="text-body text-[#8A867E] mt-0.5">{t("location", { ord: issue.location.block_ord, text: issue.location.text })}</div>
            )}
            {hasFix(issue.code) && <div className="text-body text-[#6B6862] mt-0.5">{t("howTo", { fix: t(`howToFix.${issue.code}`) })}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
