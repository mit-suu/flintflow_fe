"use client";

import type { PreflightIssue, PreflightIssueCode } from "@/types/import";

const CODE_LABELS: Record<PreflightIssueCode, string> = {
  NOT_DOCX: "Không phải file Word .docx",
  CORRUPT_ZIP: "File hỏng",
  LEGACY_DOC: "File .doc cũ (Word 97-2003)",
  FILE_ENCRYPTED: "File có mật khẩu",
  FILE_TOO_LARGE: "File quá lớn",
  EMPTY_DOCUMENT: "Tài liệu rỗng",
  FOREIGN_TRACK_CHANGE: "Track Changes chưa xử lý",
  FOREIGN_COMMENT: "Comment chưa xử lý",
};

const HOW_TO_FIX: Partial<Record<PreflightIssueCode, string>> = {
  LEGACY_DOC: "Mở bằng Word, chọn File → Save As → Word Document (.docx).",
  FILE_ENCRYPTED: "Bỏ mật khẩu (File → Info → Protect Document) rồi lưu lại.",
  FOREIGN_TRACK_CHANGE: "Vào Review → Accept/Reject tất cả thay đổi rồi lưu lại.",
  FOREIGN_COMMENT: "Vào Review → Delete All Comments (hoặc xử lý từng comment) rồi lưu lại.",
  FILE_TOO_LARGE: "Nén ảnh (File → Compress Pictures) hoặc tách phụ lục.",
};

/** 1.2 Preflight (I-1): lý do từ chối kèm vị trí trong tài liệu — sửa file rồi tải lại. */
export default function PreflightIssues({ issues, fileName }: { issues: PreflightIssue[]; fileName?: string }) {
  if (issues.length === 0) return null;
  return (
    <div role="alert" className="bg-[#FDEDED] border border-[#F2CACA] rounded-[14px] p-4 flex flex-col gap-3">
      <p className="text-[13px] font-bold text-[#8A4141]">
        {fileName ? `“${fileName}” chưa nhập được` : "File chưa nhập được"} — {issues.length} vấn đề cần sửa:
      </p>
      <ul className="flex flex-col gap-2">
        {issues.map((issue, i) => (
          <li key={`${issue.code}-${i}`} className="bg-white border border-[#F2CACA] rounded-[10px] px-3 py-2 text-[12.5px]">
            <div className="font-bold text-[#B03030]">{CODE_LABELS[issue.code] ?? issue.code}</div>
            <div className="text-[#4B4842]">{issue.message}</div>
            {issue.location && (
              <div className="text-[11.5px] text-[#8A867E] mt-0.5">
                Vị trí: đoạn thứ {issue.location.block_ord} — “{issue.location.text}”
              </div>
            )}
            {HOW_TO_FIX[issue.code] && <div className="text-[11.5px] text-[#6B6862] mt-0.5">Cách sửa: {HOW_TO_FIX[issue.code]}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
