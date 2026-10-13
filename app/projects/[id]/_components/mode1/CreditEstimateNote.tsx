"use client";

import type { CreditEstimate } from "@/types/import";
import Icon from "@/components/ui/Icon";

interface CreditEstimateNoteProps {
  estimate: CreditEstimate;
  /** Số dư header đang hiện — dùng khi BE không trả `available_credits` (Viewer). `null` = không biết. */
  fallbackBalance?: number | null;
  /** Đang chạy tiếp sau khi dừng ⇒ ước tính là phần còn lại. */
  remaining?: boolean;
}

/**
 * Ước tính lượt AI / credit của bước trích field (I-4) trước khi bấm chạy — số do BE tính từ chính kế hoạch lượt chạy
 * (`GET /import` → `credit_estimate`), FE chỉ hiển thị. Số dư nhỏ hơn số credit ước tính ⇒ cảnh báo sẽ dừng giữa chừng.
 */
export default function CreditEstimateNote({ estimate, fallbackBalance = null, remaining = false }: CreditEstimateNoteProps) {
  const balance = estimate.available_credits ?? fallbackBalance;
  const short = balance !== null && balance < estimate.credits;
  if (estimate.ai_calls === 0) {
    return (
      <p className="text-[12px] text-[#4B4842] bg-[#F7F6F3] border border-[#ECEAE5] rounded-[10px] px-3 py-2">
        Ước tính: không cần lượt AI nào — phần còn lại trích tất định, không tốn credit.
      </p>
    );
  }
  return (
    <div
      role={short ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-[10px] border px-3 py-2 text-[12px] ${
        short ? "bg-[#FBF4E4] border-[#EFD9A6] text-[#8A6D1F]" : "bg-[#F2F1FB] border-[#DCD9F2] text-[#4B4842]"
      }`}
    >
      <Icon name={short ? "warning" : "savings"} size={16} />
      <div className="flex-1">
        <p>
          {remaining ? "Ước tính phần còn lại" : "Ước tính"}: <strong>~{estimate.ai_calls} lượt AI</strong>, <strong>~{estimate.credits} credit</strong>
          {balance !== null && <> (số dư: {balance})</>}
          {estimate.diagram_images > 0 && (
            <span className="opacity-75">
              {" "}
              — {estimate.text_batches} lô chữ + {estimate.diagram_images} ảnh sơ đồ
            </span>
          )}
        </p>
        {short && (
          <p className="font-bold mt-0.5">
            Số dư chưa đủ: việc trích sẽ tạm dừng khi hết credit. Nạp thêm rồi bấm Tiếp tục — phần đã xong không tính tiền lại.
          </p>
        )}
      </div>
    </div>
  );
}
