"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import DocumentLanguagePicker from "@/components/project/DocumentLanguagePicker";
import type { SkeletonLanguage as SkeletonLanguageState } from "@/types/import";
import type { DocumentLanguage } from "@/types/project";

interface SkeletonLanguageProps {
  /** `GET /import` → `skeleton_language`; `null` hoặc không hiện ⇒ không vẽ gì. */
  state: SkeletonLanguageState | null;
  busy?: boolean;
  onChange: (language: DocumentLanguage) => void;
}

/**
 * FLF-456 (business-flow §3.1.2 "Ngôn ngữ tài liệu"): ô EN / VI của màn đọc khung. Chỉ hiện khi file chỉ còn khung (không mục nào
 * giữ nội dung); mặc định là ngôn ngữ của file. BE quyết định hiện hay ẩn ngay sau mỗi lần Giữ / Bỏ chữ. Chọn khác ngôn ngữ file
 * thì khung được dịch một lần lúc bấm Bắt đầu — số credit ở thanh bên dưới đã gồm phần dịch.
 */
export default function SkeletonLanguage({ state, busy = false, onChange }: SkeletonLanguageProps) {
  const t = useTranslations("workspace.import.skeletonLanguage");
  const tl = useTranslations("app.createProject.language");
  const titleId = useId();
  if (!state?.visible) return null;
  const translating = state.selected !== state.file;
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 rounded-card bg-surface-container p-4">
      <div className="flex flex-col gap-1">
        <h3 id={titleId} className="text-body font-bold text-on-surface">
          {t("title")}
        </h3>
        <p className="text-caption text-on-surface-variant leading-relaxed">{t("hint")}</p>
      </div>
      <DocumentLanguagePicker value={state.selected} onChange={onChange} disabled={busy} labelledBy={titleId} />
      <p role="status" className="text-caption text-on-surface-muted">
        {translating ? t("translating", { language: tl(state.selected) }) : t("fileLanguage", { language: tl(state.file) })}
      </p>
    </section>
  );
}
