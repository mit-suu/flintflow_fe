"use client";

import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";

interface AiErrorBannerProps {
  /** Việc vừa lỗi, vd tên bước "Soạn use case" hay "Trả lời trong chat". */
  what: string;
  /** Câu BE đã viết cho người dùng (tuỳ chọn, hiện dưới tiêu đề). */
  message?: string | null;
  /** `true` ⇒ BE đã tự thử lại 2 lần (lượt step / lượt không stream); chat stream không tự thử lại. */
  retried?: boolean;
  busy?: boolean;
  onRetry: () => void;
  onLater: () => void;
}

/**
 * Banner "AI lỗi" dùng chung cho chat chính và step chế độ 2 (FLF-332, business-flow §2 "Lỗi khi gọi AI"): credit đã giữ
 * được hoàn, nội dung đã Accept giữ nguyên; **Thử lại ngay** (kiểm credit lại từ đầu) hoặc **Để sau** (bước tạm dừng, mở lại
 * dự án hiện lại banner tại bước đó — BE giữ `paused_reason` trên run-state). Chế độ 1 vẫn dùng `mode1/PausedBanner`.
 */
export default function AiErrorBanner({ what, message, retried = true, busy = false, onRetry, onLater }: AiErrorBannerProps) {
  const t = useTranslations("workspace.aiError");
  return (
    <div role="alert" className="bg-error-container rounded-control p-3 text-body text-error flex flex-wrap items-center gap-3">
      <Icon name="cloud-off" size={18} />
      <div className="flex-1 min-w-[200px]">
        <p className="font-bold">{t("title", { what, retried: retried ? "yes" : "no" })}</p>
        <p className="opacity-90">{message?.trim() ? message : t("body")}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onRetry} disabled={busy} className="px-2.5 py-1 rounded-full text-body font-bold bg-error text-on-error cursor-pointer disabled:opacity-50">
          {busy ? t("retrying") : t("retry")}
        </button>
        <button type="button" onClick={onLater} disabled={busy} className="px-2.5 py-1 rounded-full text-body font-bold border border-error text-error cursor-pointer disabled:opacity-50">
          {t("later")}
        </button>
      </div>
    </div>
  );
}
