"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { listOrgTemplates } from "@/lib/api/org-library";
import { getActiveOrgId } from "@/lib/api/token-store";
import type { OrgTemplateSummary } from "@/types/org-library";

interface OrgTemplatePickerProps {
  busy: boolean;
  onPick: (orgTemplateId: string) => void;
}

/**
 * FLF-278 trên FLF-335/336 (bước 1.2): thay cho tải file, chọn mẫu tổ chức đã lưu — import từ chính file mẫu đó, mapping heading
 * BA đã xác nhận ở dự án trước áp sẵn. Tổ chức chưa lưu mẫu nào hoặc tải lỗi ⇒ không hiện gì (tải file vẫn là đường chính).
 */
export default function OrgTemplatePicker({ busy, onPick }: OrgTemplatePickerProps) {
  const t = useTranslations("mode1.importWizard.orgTemplates");
  const [templates, setTemplates] = useState<OrgTemplateSummary[]>([]);

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
    <section aria-label={t("title")} className="bg-white border border-[#ECEAE5] rounded-[14px] p-4 flex flex-col gap-2">
      <h3 className="font-extrabold text-[#191817] text-body">{t("title")}</h3>
      <p className="text-caption text-[#8A867E]">{t("help")}</p>
      <ul className="flex flex-col divide-y divide-[#F0EEEA]">
        {templates.map((tpl) => (
          <li key={tpl.id} className="py-2 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <p className="text-body font-bold text-[#191817]">{tpl.name}</p>
              <p className="text-caption text-[#8A867E]">{t("meta", { file: tpl.source_file_name, headings: tpl.heading_count, uses: tpl.uses })}</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(tpl.id)}
              className="px-3 py-1.5 rounded-[8px] border border-[#ECEAE5] bg-white text-[#191817] text-body font-bold cursor-pointer disabled:opacity-50"
            >
              {t("use")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
