"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { listOrgTemplates } from "@/lib/api/org-library";
import { getActiveOrgId } from "@/lib/api/token-store";
import type { OrgTemplateSummary } from "@/types/org-library";

interface OrgTemplatePickerProps {
  disabled?: boolean;
  onPick: (template: OrgTemplateSummary) => void;
}

/**
 * FLF-278 — lối phụ của ô SRS: thay cho tải file, chọn mẫu đã lưu của tổ chức (BE nhập từ chính file mẫu đó, mapping heading đã
 * xác nhận ở dự án trước áp sẵn). Tổ chức chưa lưu mẫu nào hoặc tải lỗi ⇒ không hiện gì (tải file vẫn là đường chính). Mặc
 * định thu gọn thành một dòng để hộp Tạo dự án không dài thêm.
 */
export default function OrgTemplatePicker({ disabled = false, onPick }: OrgTemplatePickerProps) {
  const t = useTranslations("app.createProject.orgTemplates");
  const [templates, setTemplates] = useState<OrgTemplateSummary[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const orgId = getActiveOrgId();
    if (!orgId) return;
    let cancelled = false;
    listOrgTemplates(orgId)
      .then((list) => !cancelled && setTemplates(list))
      .catch(() => !cancelled && setTemplates([]));
    return () => {
      cancelled = true;
    };
  }, []);

  if (templates.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={disabled}
        className="self-start inline-flex items-center gap-1.5 text-caption font-bold text-primary hover:underline cursor-pointer disabled:opacity-50"
      >
        <Icon name="file-template" size={14} />
        {t("toggle", { count: templates.length })}
        <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
      </button>
      {open && (
        <ul aria-label={t("title")} className="flex flex-col gap-1">
          {templates.map((tpl) => (
            <li key={tpl.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(tpl)}
                className="w-full text-left flex items-center gap-3 rounded-control px-3 py-2 bg-surface-container hover:bg-surface-container-high cursor-pointer disabled:opacity-50"
              >
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-body font-semibold text-on-surface truncate">{tpl.name}</span>
                  <span className="text-caption text-on-surface-muted truncate">{t("meta", { file: tpl.source_file_name, headings: tpl.heading_count, uses: tpl.uses })}</span>
                </span>
                <span className="shrink-0 text-caption font-bold text-primary">{t("use")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
