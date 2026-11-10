"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { listOrgTemplates } from "@/lib/api/org-library";
import type { OrgTemplateSummary } from "@/types/org-library";
import type { PreviousTemplate, StartMigrationInput } from "@/types/template-migration";
import type { MigrationTargetQuery } from "./href";

interface TargetPickerProps {
  /** Lead có thêm "đăng lên thư viện" khi tải file; Analyst chỉ tạo bản riêng của dự án. */
  /** Org của dự án (không phải org đang chọn ở thanh trên). */
  orgId: string | null;
  canPublish: boolean;
  busy: boolean;
  /** Đích điền sẵn từ thông báo bản mới. */
  preselect: MigrationTargetQuery | null;
  /** Mẫu dự án đang theo trước lần đổi gần nhất — lối tắt "quay về". */
  previous: PreviousTemplate | null;
  onStart: (input: StartMigrationInput) => void;
}

const NO_TEMPLATES: OrgTemplateSummary[] = [];

const publishedVersions = (tpl: OrgTemplateSummary): number[] => tpl.versions.filter((v) => v.status === "published").map((v) => v.version);

/**
 * Bước 1 — chọn mẫu đích: mẫu của tổ chức (bản bất kỳ, kể cả cũ hơn bản đang theo) hoặc file .docx tải lên. Tải danh sách lỗi hoặc
 * tổ chức chưa có mẫu ⇒ vẫn còn đường tải file.
 */
export default function TargetPicker({ orgId, canPublish, busy, preselect, previous, onStart }: TargetPickerProps) {
  const t = useTranslations("mode1.templateMigration.picker");
  const fileId = useId();
  const nameId = useId();
  const familyPickId = useId();
  const [loaded, setTemplates] = useState<OrgTemplateSummary[] | null>(null);
  // Không có org ⇒ không có mẫu để chọn (vẫn còn đường tải file)
  const templates = orgId ? loaded : NO_TEMPLATES;
  const [loadFailed, setLoadFailed] = useState(false);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [file, setFile] = useState<File | null>(null);
  const [publish, setPublish] = useState(false);
  const [name, setName] = useState("");
  /** Đăng thành bản mới của họ mẫu có sẵn (`""` = họ mẫu mới, cần tên). */
  const [familyId, setFamilyId] = useState("");

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    listOrgTemplates(orgId)
      .then((list) => !cancelled && setTemplates(list))
      .catch(() => !cancelled && (setTemplates([]), setLoadFailed(true)));
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const usable = useMemo(() => (templates ?? []).filter((tpl) => publishedVersions(tpl).length > 0), [templates]);
  const versionOf = (tpl: OrgTemplateSummary): number => chosen[tpl.id] ?? (preselect?.templateId === tpl.id ? preselect.version : tpl.latest_version);
  const publishNeedsName = canPublish && publish && !familyId && !name.trim();

  return (
    <div className="flex flex-col gap-5">
      <p className="text-body text-on-surface-variant">{t("intro")}</p>

      {previous && (
        <div className="rounded-card bg-surface-container-low p-3 flex flex-wrap items-center gap-3">
          <p className="flex-1 min-w-[200px] text-body text-on-surface">
            {t(previous.visibility === "project" ? "previousPrivate" : "previousNamed", { name: previous.name, version: previous.version })}
          </p>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onStart({ kind: "template", template_id: previous.template_id, version: previous.version })}>
            {t("usePrevious")}
          </Button>
        </div>
      )}

      <section className="flex flex-col gap-2" aria-label={t("orgTitle")}>
        <h4 className="text-body font-extrabold text-on-surface">{t("orgTitle")}</h4>
        {templates === null ? (
          <p className="text-body text-on-surface-muted">{t("loading")}</p>
        ) : usable.length === 0 ? (
          <p className="text-body text-on-surface-muted">{loadFailed ? t("loadFailed") : t("orgEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {usable.map((tpl) => {
              const versions = publishedVersions(tpl);
              const version = versionOf(tpl);
              const highlighted = preselect?.templateId === tpl.id;
              return (
                <li key={tpl.id} className={`flex flex-wrap items-center gap-3 rounded-control px-3 py-2 ${highlighted ? "bg-primary-soft" : "bg-surface-container-low"}`}>
                  <span className="flex-1 min-w-[160px] flex flex-col">
                    <span className="text-body font-semibold text-on-surface truncate">{tpl.name}</span>
                    <span className="text-caption text-on-surface-muted truncate">{t("meta", { file: tpl.source_file_name, headings: tpl.heading_count })}</span>
                  </span>
                  <select
                    aria-label={t("versionLabel", { name: tpl.name })}
                    value={version}
                    disabled={busy}
                    onChange={(e) => setChosen((prev) => ({ ...prev, [tpl.id]: Number(e.target.value) }))}
                    className="h-8 rounded-control bg-surface-container-lowest px-2 text-caption font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {versions.map((v) => (
                      <option key={v} value={v}>
                        {v === tpl.latest_version ? t("versionLatest", { version: v }) : t("versionOption", { version: v })}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" disabled={busy} onClick={() => onStart({ kind: "template", template_id: tpl.id, version })} aria-label={t("useAria", { name: tpl.name, version })}>
                    {t("use")}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-label={t("fileTitle")}>
        <h4 className="text-body font-extrabold text-on-surface">{t("fileTitle")}</h4>
        <p className="text-caption text-on-surface-muted">{canPublish ? t("fileHelpLead") : t("fileHelpAnalyst")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label htmlFor={fileId} className="flex flex-col gap-1 text-caption font-bold text-on-surface-medium">
            {t("fileLabel")}
            <input
              id={fileId}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-body font-normal text-on-surface-variant"
            />
          </label>
          {canPublish && (
            <label className="inline-flex items-center gap-2 text-caption font-bold text-on-surface-variant cursor-pointer">
              <input type="checkbox" checked={publish} disabled={busy} onChange={(e) => setPublish(e.target.checked)} />
              {t("publish")}
            </label>
          )}
          {canPublish && publish && usable.length > 0 && (
            <label htmlFor={familyPickId} className="flex flex-col gap-1 text-caption font-bold text-on-surface-medium">
              {t("familyLabel")}
              <select
                id={familyPickId}
                value={familyId}
                disabled={busy}
                onChange={(e) => setFamilyId(e.target.value)}
                className="h-9 w-[240px] max-w-full rounded-control bg-surface-container-lowest px-2 text-body font-normal text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">{t("familyNew")}</option>
                {usable.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {t("familyNext", { name: tpl.name })}
                  </option>
                ))}
              </select>
            </label>
          )}
          {canPublish && publish && !familyId && (
            <label htmlFor={nameId} className="flex flex-col gap-1 text-caption font-bold text-on-surface-medium">
              {t("nameLabel")}
              <input
                id={nameId}
                value={name}
                maxLength={120}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-[240px] max-w-full rounded-control bg-surface-container-lowest px-3 text-body font-normal text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
          )}
          <Button
            size="sm"
            icon="upload"
            disabled={!file || publishNeedsName}
            loading={busy}
            onClick={() => file && onStart({ kind: "file", file, ...(canPublish && publish ? { publish_to_org: true, ...(familyId ? { template_id: familyId } : { name: name.trim() }) } : {}) })}
          >
            {t("useFile")}
          </Button>
        </div>
        {publishNeedsName && <p className="text-caption text-on-surface-muted flex items-center gap-1"><Icon name="info" size={14} />{t("nameRequired")}</p>}
      </section>
    </div>
  );
}
