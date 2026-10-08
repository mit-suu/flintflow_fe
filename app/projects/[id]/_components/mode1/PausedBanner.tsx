"use client";

import Link from "next/link";
import type { Paused } from "@/types/import";
import { formatDateTime } from "./labels";
import Icon from "@/components/ui/Icon";

interface PausedBannerProps {
  paused: Paused;
  /** "Tiếp tục" gọi `…/resume` (import hoặc CR). */
  onResume: () => void;
  busy?: boolean;
  /** Việc đang dừng, vd "Trích field" / "Đề xuất sửa". */
  what: string;
}

/**
 * Flow 4/5 (UC-61, UC-75): bước AI dừng vì hết credit hoặc lỗi AI sau 2 lần thử. Credit đã giữ được hoàn;
 * phần đã xong không chạy lại. Dùng chung cho import (I-4) và change request (C-2/C-4/C-5).
 */
export default function PausedBanner({ paused, onResume, busy = false, what }: PausedBannerProps) {
  const credits = paused.reason === "credits";
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-3 rounded-[12px] border px-4 py-3 text-[12.5px] ${
        credits ? "bg-[#FBF4E4] border-[#EFD9A6] text-[#8A6D1F]" : "bg-[#FDEDED] border-[#F2CACA] text-[#8A4141]"
      }`}
    >
      <Icon name={credits ? "savings" : "cloud-off"} size={18} />
      <div className="flex-1 min-w-[220px]">
        <p className="font-bold">
          {what} đang tạm dừng — {credits ? "hết credit" : "AI lỗi, đã thử lại 2 lần"}
        </p>
        <p className="opacity-90">
          {credits
            ? "Nạp thêm credit rồi bấm Tiếp tục. Phần đã xong được giữ, không tính tiền lại."
            : "Credit đã giữ được hoàn lại. Bấm Tiếp tục để chạy lại từ chỗ dừng, hoặc để sau."}{" "}
          <span className="opacity-70">({formatDateTime(paused.at)})</span>
        </p>
      </div>
      {credits && (
        <Link href="/home/billing" className="px-3 py-1.5 rounded-[8px] border border-current font-bold hover:opacity-80">
          Nạp credit
        </Link>
      )}
      <button
        type="button"
        onClick={onResume}
        disabled={busy}
        className="px-3 py-1.5 rounded-[8px] bg-[#191817] text-white font-bold disabled:opacity-50 cursor-pointer"
      >
        {busy ? "Đang chạy…" : "Tiếp tục"}
      </button>
    </div>
  );
}
