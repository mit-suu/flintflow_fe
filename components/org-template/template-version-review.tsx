"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import type { HeadingEdit, TemplateVersionDetail } from "@/types/org-library";
import MappingReview, { useSectionOptions } from "./mapping-review";

interface TemplateVersionReviewProps {
  detail: TemplateVersionDetail;
  busy?: boolean;
  /** Đăng bản nháp với các dòng Lead đã sửa (chỉ dòng khác bản tự nhận). */
  onPublish: (headings: HeadingEdit[]) => void;
  onCancel: () => void;
}

/**
 * Lead rà mapping heading của bản nháp vừa tải rồi đăng. File mẫu còn chữ thật (nội dung cũ chưa xoá) ⇒ cảnh báo trước khi đăng
 * (FLF-412). Dùng ở trang Thư viện mẫu và ở hộp Tạo dự án ("Tải mẫu lên thư viện"). `key` theo bản để đổi bản là xoá sửa cũ.
 */
export default function TemplateVersionReview({ detail, busy = false, onPublish, onCancel }: TemplateVersionReviewProps) {
  const t = useTranslations("app.org.library.templates");
  const sectionOptions = useSectionOptions();
  /** section đã đổi theo vị trí heading — chỉ gửi những dòng khác bản tự nhận. */
  const [edits, setEdits] = useState<Record<number, string>>({});
  const withText = detail.headings.filter((h) => h.has_text).length;

  return (
    <section aria-label={t("reviewTitle", { name: detail.name, version: detail.version })} className="flex flex-col gap-3 rounded-card bg-surface-container-low p-4">
      <h3 className="text-body font-extrabold text-on-surface">{t("reviewTitle", { name: detail.name, version: detail.version })}</h3>
      {withText > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-control bg-accent-gold-soft px-3 py-2 text-body text-accent-gold-text">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          {t("contentWarning", { count: withText, total: detail.headings.length })}
        </p>
      )}
      <MappingReview
        headings={detail.headings.map((h) => ({ index: h.index, heading_text: h.heading_text, section_id: edits[h.index] ?? h.section_id, needs_review: h.auto_confirmed, reviewed: edits[h.index] !== undefined }))}
        sectionOptions={sectionOptions}
        disabled={busy}
        onChange={(index, sectionId) =>
          setEdits((prev) => {
            const original = detail.headings.find((h) => h.index === index)?.section_id;
            const next = { ...prev };
            if (sectionId === original) delete next[index];
            else next[index] = sectionId;
            return next;
          })
        }
      />
      <div className="flex gap-3">
        <Button size="sm" loading={busy} onClick={() => onPublish(Object.entries(edits).map(([index, section_id]) => ({ index: Number(index), section_id })))}>
          {t("publish")}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </section>
  );
}
