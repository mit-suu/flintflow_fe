"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("mode1.creditEstimate");
  const balance = estimate.available_credits ?? fallbackBalance;
  const short = balance !== null && balance < estimate.credits;
  if (estimate.ai_calls === 0) {
    return (
      <p className="text-[12px] text-[#4B4842] bg-[#F7F6F3] border border-[#ECEAE5] rounded-[10px] px-3 py-2">
        {t("none")}
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
          {t.rich("estimate", {
            remaining: remaining ? "yes" : "no",
            calls: estimate.ai_calls,
            credits: estimate.credits,
            strong: (c) => <strong>{c}</strong>,
          })}
          {balance !== null && <> {t("balance", { balance })}</>}
          {(estimate.check_calls ?? 0) > 0 ? (
            // FLF-343: ước tính cả lượt một mạch — gồm lượt kiểm tra AI sau baseline 0.1
            <span className="opacity-75">
              {" "}
              — {t("breakdownWithChecks", { text: estimate.text_batches, images: estimate.diagram_images, checks: estimate.check_calls ?? 0 })}
            </span>
          ) : (
            estimate.diagram_images > 0 && (
              <span className="opacity-75">
                {" "}
                — {t("breakdown", { text: estimate.text_batches, images: estimate.diagram_images })}
              </span>
            )
          )}
        </p>
        {short && (
          <p className="font-bold mt-0.5">
            {t("short")}
          </p>
        )}
      </div>
    </div>
  );
}
