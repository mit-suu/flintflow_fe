"use client";

import { SectionType } from "../../../../lib/constants/section-types";

interface DraftReviewCardProps {
  sectionType: SectionType;
  sectionLabel: string;
  contentPreview?: string;
  status: string;
  onAccept: () => void;
  onRevise: () => void;
  onRegenerate: () => void;
  isAccepting?: boolean;
  isRegenerating?: boolean;
}

export default function DraftReviewCard({
  sectionLabel,
  contentPreview,
  status,
  onAccept,
  onRevise,
  onRegenerate,
  isAccepting = false,
  isRegenerating = false,
}: DraftReviewCardProps) {
  const isAccepted = status === "accepted";

  if (isAccepted) {
    return (
      <div className="w-full bg-[#E9F7EE] border border-[#BFE6CE] rounded-[14px] p-4 flex flex-col gap-2 shadow-xs">
        <div className="flex items-center gap-2 text-[#1F7A45] font-extrabold text-[12.5px]">
          <span className="w-5 h-5 rounded-full bg-[#1F7A45] text-white flex items-center justify-center text-[10px]">
            ✓
          </span>
          <span>{sectionLabel} đã được nghiệm thu vào SRS</span>
        </div>
        <p className="text-[12px] text-[#4B4842] pl-7 leading-relaxed">
          Nội dung đặc tả đã được commit vào bản Working Draft. Bạn có thể xem
          chi tiết ở cột tài liệu bên phải.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full relative border-2 border-transparent rounded-[18px] p-5 bg-linear-to-r from-[#FBFAFF] to-[#FBFAFF] bg-clip-padding shadow-[0_10px_28px_rgba(79,70,229,0.12)] flex flex-col gap-3.5 my-2 before:content-[''] before:absolute before:inset-0 before:-m-[2px] before:rounded-[20px] before:bg-linear-to-r before:from-[#7C74F0] before:via-[#4F46E5] before:to-[#E8A23D] before:-z-10">
      {/* Floating Badge */}
      <div className="self-start -mt-8 px-3 py-0.5 rounded-full bg-linear-to-r from-[#7C74F0] to-[#4F46E5] text-white text-[10px] font-extrabold tracking-wider uppercase shadow-[0_4px_12px_rgba(79,70,229,0.35)]">
        DRAFT — CHỜ NGHIỆM THU
      </div>

      <div className="flex items-center justify-between">
        <h4 className="font-extrabold text-[13.5px] text-[#191817] flex items-center gap-1.5">
          <span>📄</span>
          <span>{sectionLabel} — Sẵn sàng để duyệt</span>
        </h4>
      </div>

      <p className="text-[12px] text-[#6B6862] leading-relaxed">
        AI đã sinh xong nội dung đặc tả cho phần này. Vui lòng xem bản xem trước
        ở khung tài liệu và xác nhận trước khi lưu vào SRS.
      </p>

      {contentPreview && (
        <div className="p-3 bg-white border border-[#ECEAE5] rounded-[10px] text-[11.5px] text-[#4B4842] font-mono line-clamp-3 leading-relaxed">
          {contentPreview}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onAccept}
          disabled={isAccepting || isRegenerating}
          className="px-4 py-1.5 rounded-full btn-gradient-primary text-white text-[11.5px] font-bold flex items-center gap-1.5 cursor-pointer shadow-md hover:opacity-95 transition-opacity"
        >
          {isAccepting ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>✓</span>
          )}
          <span>Nghiệm thu (Accept)</span>
        </button>

        <button
          type="button"
          onClick={onRevise}
          disabled={isAccepting || isRegenerating}
          className="px-3.5 py-1.5 rounded-full bg-white border border-[#DDD9F6] text-[#4F46E5] hover:bg-[#F4F3FE] text-[11.5px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <span>✎</span>
          <span>Yêu cầu sửa qua chat</span>
        </button>

        <button
          type="button"
          onClick={onRegenerate}
          disabled={isAccepting || isRegenerating}
          className="px-3 py-1.5 rounded-full bg-white border border-[#ECEAE5] text-[#6B6862] hover:bg-[#FAF9F7] text-[11.5px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
        >
          {isRegenerating ? (
            <span className="w-3 h-3 border-2 border-[#6B6862] border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>↻</span>
          )}
          <span>Tạo lại</span>
        </button>
      </div>

      <div className="text-[10px] text-[#A8A49C] font-mono">
        confirm-before-commit · Phase Gate Rule
      </div>
    </div>
  );
}
