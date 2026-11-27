"use client";

import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";

/**
 * FLF-458: màn đọc khung báo file vừa tải lên thực ra lấy từ một project FlintFlow khác (I-1) — dấu cũ đã bị bỏ, file được
 * xử lý như file mới (mặc định Bỏ chữ mọi mục, xem `TextSections`/`drop_text`). Tách riêng khỏi `structure-preview.tsx` để
 * các khối khác của màn đọc khung (Ngoài phạm vi, đổi nhãn, ô ngôn ngữ…) ghép vào sau không đụng cùng đoạn JSX.
 */
export default function ForeignProjectNotice({ name }: { name: string | null }) {
  const t = useTranslations("workspace.import.preview");
  return (
    <p role="status" className="flex items-start gap-2 rounded-card bg-surface-container px-4 py-3 text-body text-on-surface-variant">
      <Icon name="info" size={16} className="mt-0.5 shrink-0" />
      {name ? t("foreignProject.named", { name }) : t("foreignProject.unnamed")}
    </p>
  );
}
