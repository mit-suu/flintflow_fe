"use client";

import { useId, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { userErrorMessage } from "@/lib/api/error-messages";
import {
  deleteOrgTemplate,
  deleteTemplateVersion,
  getTemplateVersion,
  publishTemplateVersion,
  uploadOrgTemplate,
  uploadTemplateVersion,
} from "@/lib/api/org-library";
import type { HeadingEdit, OrgTemplateSummary, TemplateVersionDetail } from "@/types/org-library";
import type { OrgRole } from "@/types/organization";
import MappingReview, { useSectionOptions } from "./mapping-review";
import PendingHeadingsReview from "./pending-headings-review";

interface TemplateLibraryListProps {
  orgId: string;
  role: OrgRole | null;
  templates: readonly OrgTemplateSummary[];
  /** Tải lại danh sách mẫu sau mỗi thay đổi. */
  onChanged: () => Promise<void>;
}

/** Thứ đang chờ xác nhận xoá: cả họ mẫu hoặc một bản. */
type Confirm = { kind: "family"; id: string; projects: number } | { kind: "version"; id: string; version: number; projects: number } | null;

/**
 * Danh sách mẫu của tổ chức kèm các bản. Mọi thành viên xem; chỉ Lead tải mẫu / đăng bản mới (qua màn rà mapping) / xoá — BE kiểm lại.
 * Họ mẫu chỉ có bản nháp (chưa đăng) chỉ Lead thấy, để đăng tiếp hoặc xoá.
 */
export default function TemplateLibraryList({ orgId, role, templates, onChanged }: TemplateLibraryListProps) {
  const t = useTranslations("app.org.library.templates");
  const format = useFormatter();
  const nameId = useId();
  const isLead = role === "lead";
  const sectionOptions = useSectionOptions();
  const newFileRef = useRef<HTMLInputElement>(null);
  const versionFileRef = useRef<HTMLInputElement>(null);
  /** Họ mẫu đang chờ chọn file cho bản mới (input file dùng chung). */
  const uploadTarget = useRef<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [review, setReview] = useState<TemplateVersionDetail | null>(null);
  /** Họ khung tự lưu đang mở danh sách duyệt mục chờ (duyệt qua dự án nguồn). */
  const [pendingOpen, setPendingOpen] = useState<string | null>(null);
  const canReviewPending = role === "lead" || role === "analyst";
  /** section đã đổi theo vị trí heading — chỉ gửi những dòng khác bản tự nhận. */
  const [edits, setEdits] = useState<Record<number, string>>({});

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(userErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openReview = (detail: TemplateVersionDetail) => {
    setReview(detail);
    setEdits({});
  };

  const upload = (file: File | undefined, templateId: string | null) => {
    if (!file) return;
    void run(async () => {
      const detail = templateId ? await uploadTemplateVersion(orgId, templateId, file) : await uploadOrgTemplate(orgId, newName.trim(), file);
      setShowNew(false);
      setNewName("");
      await onChanged();
      openReview(detail);
    });
  };

  const publish = () => {
    if (!review) return;
    const headings: HeadingEdit[] = Object.entries(edits).map(([index, section_id]) => ({ index: Number(index), section_id }));
    void run(async () => {
      await publishTemplateVersion(orgId, review.template_id, review.version, headings);
      setReview(null);
      setEdits({});
      await onChanged();
    });
  };

  const remove = () => {
    if (!confirm) return;
    void run(async () => {
      if (confirm.kind === "family") await deleteOrgTemplate(orgId, confirm.id);
      else await deleteTemplateVersion(orgId, confirm.id, confirm.version);
      if (review && review.template_id === confirm.id && (confirm.kind === "family" || review.version === confirm.version)) setReview(null);
      setConfirm(null);
      await onChanged();
    });
  };

  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });
  const isConfirming = (c: NonNullable<Confirm>) => confirm?.kind === c.kind && confirm.id === c.id && (c.kind === "family" || (confirm.kind === "version" && confirm.version === c.version));

  const confirmBar = (c: NonNullable<Confirm>) => (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-control bg-error-container px-3 py-2 text-on-error-container">
      <p className="flex-1 min-w-[220px] text-body">{t(c.kind === "family" ? "confirmFamily" : "confirmVersion", { count: c.projects })}</p>
      <Button size="sm" variant="danger" loading={busy} onClick={remove}>
        {t("confirmDelete")}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>
        {t("cancel")}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <input ref={newFileRef} type="file" accept=".docx" hidden aria-label={t("pickNewFile")} onChange={(e) => { upload(e.target.files?.[0], null); e.target.value = ""; }} />
      <input
        ref={versionFileRef}
        type="file"
        accept=".docx"
        hidden
        aria-label={t("pickVersionFile")}
        onChange={(e) => {
          upload(e.target.files?.[0], uploadTarget.current);
          e.target.value = "";
        }}
      />

      {isLead && (
        <div className="flex flex-col gap-2">
          {showNew ? (
            <div className="flex flex-wrap items-end gap-3 rounded-card bg-surface-container-low p-3">
              <label htmlFor={nameId} className="flex flex-col gap-1 text-caption font-bold text-on-surface-variant">
                {t("newNameLabel")}
                <input
                  id={nameId}
                  value={newName}
                  maxLength={120}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-9 w-[260px] max-w-full rounded-control bg-surface-container-lowest px-3 text-body font-normal text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <Button size="sm" disabled={!newName.trim() || busy} loading={busy} onClick={() => newFileRef.current?.click()}>
                {t("pickFile")}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setShowNew(false)}>
                {t("cancel")}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" className="self-start" disabled={busy} onClick={() => setShowNew(true)}>
              {t("newTemplate")}
            </Button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-body text-error">
          {error}
        </p>
      )}

      {review && (
        <section aria-label={t("reviewTitle", { name: review.name, version: review.version })} className="flex flex-col gap-3 rounded-card bg-surface-container-low p-4">
          <h3 className="text-body font-extrabold text-on-surface">{t("reviewTitle", { name: review.name, version: review.version })}</h3>
          <MappingReview
            headings={review.headings.map((h) => ({ index: h.index, heading_text: h.heading_text, section_id: edits[h.index] ?? h.section_id, needs_review: h.auto_confirmed, reviewed: edits[h.index] !== undefined }))}
            sectionOptions={sectionOptions}
            disabled={busy}
            onChange={(index, sectionId) =>
              setEdits((prev) => {
                const original = review.headings.find((h) => h.index === index)?.section_id;
                const next = { ...prev };
                if (sectionId === original) delete next[index];
                else next[index] = sectionId;
                return next;
              })
            }
          />
          <div className="flex gap-3">
            <Button size="sm" loading={busy} onClick={publish}>
              {t("publish")}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setReview(null)}>
              {t("cancel")}
            </Button>
          </div>
        </section>
      )}

      {templates.length === 0 ? (
        <p className="text-body text-on-surface-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {templates.map((tpl) => {
            const family = { kind: "family", id: tpl.id, projects: tpl.project_count } as const;
            return (
              <li key={tpl.id} className="rounded-card bg-surface-container-low p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[220px] flex flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-body font-bold text-on-surface">{tpl.name}</p>
                      {tpl.latest_version > 0 ? <Badge tone="primary">{t("latest", { version: tpl.latest_version })}</Badge> : <Badge tone="neutral">{t("draftOnly")}</Badge>}
                      {tpl.skeleton && <Badge tone="info">{t("skeleton")}</Badge>}
                      {tpl.pending_count > 0 && <Badge tone="warning">{t("pending", { count: tpl.pending_count })}</Badge>}
                    </div>
                    <p className="text-caption text-on-surface-muted">
                      {t("meta", { file: tpl.source_file_name, headings: tpl.heading_count, customs: tpl.custom_count, uses: tpl.uses, projects: tpl.project_count, date: date(tpl.created_at) })}
                    </p>
                    {tpl.pending_count > 0 && !tpl.skeleton_source_project_id && <p className="text-caption text-on-surface-muted">{t("pendingHint")}</p>}
                  </div>
                  {tpl.pending_count > 0 && tpl.skeleton_source_project_id && (
                    <Button size="sm" variant="secondary" aria-expanded={pendingOpen === tpl.id} onClick={() => setPendingOpen((cur) => (cur === tpl.id ? null : tpl.id))}>
                      {pendingOpen === tpl.id ? t("hidePending") : t("reviewPending")}
                    </Button>
                  )}
                  {isLead && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          uploadTarget.current = tpl.id;
                          versionFileRef.current?.click();
                        }}
                      >
                        {t("publishNew")}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(family)}>
                        {t("delete")}
                      </Button>
                    </>
                  )}
                </div>
                {isConfirming(family) && confirmBar(family)}
                {pendingOpen === tpl.id && tpl.skeleton_source_project_id && (
                  <PendingHeadingsReview projectId={tpl.skeleton_source_project_id} canReview={canReviewPending} onChange={() => void onChanged().catch((err: unknown) => setError(userErrorMessage(err)))} />
                )}
                <ul aria-label={t("versionsLabel", { name: tpl.name })} className="flex flex-col gap-1.5">
                  {tpl.versions.map((v) => {
                    const ver = { kind: "version", id: tpl.id, version: v.version, projects: v.project_count } as const;
                    return (
                      <li key={v.version} className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface-container-lowest px-3 py-2">
                          <span className="text-body font-semibold text-on-surface">{t("versionName", { version: v.version })}</span>
                          {v.status === "draft" && <Badge tone="neutral">{t("draft")}</Badge>}
                          {v.version === tpl.latest_version && <Badge tone="primary">{t("latestBadge")}</Badge>}
                          <span className="flex-1 min-w-[160px] text-caption text-on-surface-muted">
                            {t("versionMeta", { date: date(v.created_at), projects: v.project_count, file: v.source_file_name })}
                            {v.published_by && <> · {v.published_by.name ? t("publishedBy", { name: v.published_by.name }) : t("publishedByFormer")}</>}
                          </span>
                          {isLead && v.status === "draft" && (
                            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(async () => openReview(await getTemplateVersion(orgId, tpl.id, v.version)))}>
                              {t("reviewAndPublish")}
                            </Button>
                          )}
                          {isLead && (
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(ver)}>
                              {t("deleteVersion")}
                            </Button>
                          )}
                        </div>
                        {isConfirming(ver) && confirmBar(ver)}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
