"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { listOrgTemplates } from "@/lib/api/org-library";
import { getActiveOrgId } from "@/lib/api/token-store";
import type { OrgTemplateSummary } from "@/types/org-library";

interface OrgTemplatePickerProps {
  disabled?: boolean;
  /** `version` = bản người dùng chọn (mặc định bản đã đăng mới nhất). */
  onPick: (template: OrgTemplateSummary, version: number) => void;
}

/** Số bản đã đăng của một mẫu, mới nhất trước. Bản nháp (chỉ Lead thấy) không chọn được. */
const publishedVersions = (tpl: OrgTemplateSummary): number[] => tpl.versions.filter((v) => v.status === "published").map((v) => v.version);

/**
 * FLF-278 — lối phụ của ô SRS: thay cho tải file, chọn mẫu đã lưu của tổ chức (BE nhập từ chính file mẫu đó, mapping heading đã
 * xác nhận ở dự án trước áp sẵn) và bản của mẫu (mặc định mới nhất). Họ mẫu chưa đăng bản nào không hiện. Tổ chức chưa lưu mẫu nào
 * hoặc tải lỗi ⇒ không hiện gì (tải file vẫn là đường chính). Mặc định thu gọn thành một dòng để hộp Tạo dự án không dài thêm.
 */
export default function OrgTemplatePicker({ disabled = false, onPick }: OrgTemplatePickerProps) {
  const t = useTranslations("app.createProject.orgTemplates");
  const [templates, setTemplates] = useState<OrgTemplateSummary[]>([]);
  const [open, setOpen] = useState(false);
  /** Bản đã chọn theo mẫu; chưa chọn ⇒ bản mới nhất. */
  const [chosen, setChosen] = useState<Record<string, number>>({});

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

  const usable = useMemo(() => templates.filter((tpl) => tpl.latest_version > 0), [templates]);

  if (usable.length === 0) return null;
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
        {t("toggle", { count: usable.length })}
        <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
      </button>
      {open && (
        <ul aria-label={t("title")} className="flex flex-col gap-1">
          {usable.map((tpl) => {
            const versions = publishedVersions(tpl);
            const version = chosen[tpl.id] ?? tpl.latest_version;
            return (
              <li key={tpl.id} className="flex items-center gap-2 rounded-control px-3 py-2 bg-surface-container hover:bg-surface-container-high">
                <button type="button" disabled={disabled} onClick={() => onPick(tpl, version)} className="flex-1 min-w-0 text-left flex items-center gap-3 cursor-pointer disabled:opacity-50">
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="text-body font-semibold text-on-surface truncate">{tpl.name}</span>
                    <span className="text-caption text-on-surface-muted truncate">{t("meta", { file: tpl.source_file_name, headings: tpl.heading_count, uses: tpl.uses })}</span>
                  </span>
                  <span className="shrink-0 text-caption font-bold text-primary">{t("use")}</span>
                </button>
                {versions.length > 1 && (
                  <select
                    aria-label={t("versionLabel", { name: tpl.name })}
                    value={version}
                    disabled={disabled}
                    onChange={(e) => setChosen((prev) => ({ ...prev, [tpl.id]: Number(e.target.value) }))}
                    className="h-8 shrink-0 rounded-control bg-surface-container-lowest px-2 text-caption font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {versions.map((v) => (
                      <option key={v} value={v}>
                        {v === tpl.latest_version ? t("versionLatest", { version: v }) : t("versionOption", { version: v })}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
