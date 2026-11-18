"use client";

import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";

interface DocumentUpdatePillProps {
  /** Số mục đang chờ bản mới. Nhãn chỉ hiện từ 2 mục trở lên — một mục đã có nền + vạch ngay tại chỗ. */
  pendingCount: number;
  /** Số vùng vừa cập nhật mà người đọc chưa từng thấy (đang ngoài khung nhìn). */
  updatedCount: number;
  /** Đổi diện rộng (quá nửa mục): không tô từng mục, chỉ báo một nhãn chung. */
  generic: boolean;
  /** Bấm nhãn "N mục vừa cập nhật": nhảy tới vùng chưa xem kế tiếp. */
  onJump: () => void;
  /** Bấm nhãn chung: ẩn đi. */
  onDismiss: () => void;
}

/**
 * Nhãn nổi ở đáy vùng tài liệu — báo thay đổi mà người đọc không tự thấy: nhiều mục đang cập nhật, mục vừa cập nhật nằm
 * ngoài màn hình (bấm nhảy lần lượt; xem hết thì tự ẩn), hay bản mới đổi diện rộng. Không có % giả, không che chữ nào:
 * chỉ một viên thuốc nhỏ ở giữa đáy.
 */
export default function DocumentUpdatePill({ pendingCount, updatedCount, generic, onJump, onDismiss }: DocumentUpdatePillProps) {
  const t = useTranslations("workspace.document");
  const base = "pointer-events-auto h-8 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-primary text-on-primary text-body font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.25)]";

  let pill = null;
  if (pendingCount > 1) {
    pill = <span className={base}>{t("pillUpdating", { count: pendingCount })}</span>;
  } else if (updatedCount > 0) {
    pill = (
      <button type="button" onClick={onJump} title={t("pillJumpTitle")} className={`${base} cursor-pointer hover:bg-primary-hover transition-colors`}>
        {t("pillUpdated", { count: updatedCount })}
        <Icon name="chevron-down" size={14} />
      </button>
    );
  } else if (generic) {
    pill = (
      <button type="button" onClick={onDismiss} title={t("pillDismissTitle")} className={`${base} cursor-pointer hover:bg-primary-hover transition-colors`}>
        {t("updatedGeneric")}
      </button>
    );
  }
  if (!pill) return null;
  return (
    <div aria-live="polite" className="pointer-events-none absolute bottom-4 inset-x-0 z-20 flex justify-center">
      {pill}
    </div>
  );
}
