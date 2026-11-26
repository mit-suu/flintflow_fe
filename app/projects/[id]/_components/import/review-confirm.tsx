"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import type { ReviewContentMismatch, ReviewGuidance } from "@/types/import";

interface ReviewConfirmProps {
  guidance: ReviewGuidance[];
  contentMismatch: ReviewContentMismatch[];
  busy: boolean;
  onGuidance: (item: ReviewGuidance, isGuidance: boolean) => void;
  onMismatch: (item: ReviewContentMismatch) => void;
  onConfirmAll: () => void;
}

/**
 * Bước 1.6 (FLF-462): màn xác nhận sau I-4 - đoạn lớp 4 chữ hướng dẫn AI phân loại (độ tin thấp) và mục tên đúng nội dung
 * sai (FLF-444 đánh dấu). Phần tử I-4 độ tin thấp dùng chung endpoint nhưng chưa có màn riêng ở đây - vẫn qua nút
 * "Xác nhận tất cả theo gợi ý". Không còn gì cần xác nhận ⇒ BE tự chuyển sang bước dựng bản gốc, trang poll thấy ngay.
 */
export default function ReviewConfirm({ guidance, contentMismatch, busy, onGuidance, onMismatch, onConfirmAll }: ReviewConfirmProps) {
  const t = useTranslations("workspace.import.review");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-heading font-bold text-on-surface">{t("title")}</h2>
        <p className="text-body text-on-surface-variant">{t("intro")}</p>
      </div>
      {guidance.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-body font-semibold text-on-surface">{t("guidance.title")}</h3>
          {guidance.map((g) => (
            <div key={`${g.section_id}:${g.block_id}`} className="flex flex-col gap-2 rounded-card bg-surface-container px-4 py-3">
              <p className="text-body text-on-surface whitespace-pre-wrap">{g.text}</p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => onGuidance(g, true)}>
                  {t("guidance.isGuidance")}
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => onGuidance(g, false)}>
                  {t("guidance.isContent")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {contentMismatch.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-body font-semibold text-on-surface">{t("mismatch.title")}</h3>
          {contentMismatch.map((m) => (
            <div key={m.section_id} className="flex flex-wrap items-center gap-3 rounded-card bg-surface-container px-4 py-3">
              <p className="flex-1 text-body text-on-surface">{t("mismatch.body", { heading: m.by_heading.join(", ") || m.section_id })}</p>
              <Button variant="secondary" disabled={busy} onClick={() => onMismatch(m)}>
                {t("mismatch.ack")}
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button className="self-start" loading={busy} onClick={onConfirmAll}>
        {t("confirmAll")}
      </Button>
    </div>
  );
}
