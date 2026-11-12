"use client";

import { useId, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge, Button, Modal } from "@/components/ui";
import { userErrorMessage } from "@/lib/api/error-messages";
import { deleteTemplateVersion, getTemplateVersion, publishTemplateVersion, uploadOrgTemplate } from "@/lib/api/org-library";
import type { HeadingEdit, OrgTemplateSummary, TemplateVersionDetail } from "@/types/org-library";
import MappingReview, { useSectionOptions } from "./mapping-review";

/** Chạy một thao tác gọi BE: khoá nút trong lúc gửi, lỗi BE hiện tại chỗ (giữ hộp thoại mở). */
const useRunner = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  return { busy, error, run };
};

const ErrorLine = ({ message }: { message: string | null }) =>
  message ? (
    <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
      {message}
    </p>
  ) : null;

interface TemplateVersionsDialogProps {
  orgId: string;
  template: OrgTemplateSummary;
  isLead: boolean;
  onClose: () => void;
  /** Lead bấm rà mapping một bản nháp ⇒ trang mở hộp rà mapping. */
  onReview: (detail: TemplateVersionDetail) => void;
  /** Tải lại thư viện sau khi xoá bản. */
  onChanged: () => void;
}

/**
 * Các bản của một mẫu (FLF-395): mọi thành viên xem; chỉ Lead rà mapping bản nháp để đăng và xoá bản (BE kiểm lại). Xoá bản
 * hỏi lại tại chỗ, kèm số dự án đang theo bản đó.
 */
export function TemplateVersionsDialog({ orgId, template, isLead, onClose, onReview, onChanged }: TemplateVersionsDialogProps) {
  const t = useTranslations("app.org.library.templates");
  const format = useFormatter();
  const { busy, error, run } = useRunner();
  /** Bản đang chờ xác nhận xoá. */
  const [confirm, setConfirm] = useState<{ version: number; projects: number } | null>(null);
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  const remove = () =>
    void run(async () => {
      if (!confirm) return;
      await deleteTemplateVersion(orgId, template.id, confirm.version);
      setConfirm(null);
      onChanged();
    });

  return (
    <Modal open onClose={() => !busy && onClose()} title={t("versionsLabel", { name: template.name })} size="lg">
      <div className="flex flex-col gap-3">
        <ErrorLine message={error} />
        <ul aria-label={t("versionsLabel", { name: template.name })} className="flex flex-col gap-1.5">
          {template.versions.map((v) => (
            <li key={v.version} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface-container-low px-3 py-2">
                <span className="text-body font-semibold text-on-surface">{t("versionName", { version: v.version })}</span>
                {v.status === "draft" && <Badge tone="neutral">{t("draft")}</Badge>}
                {v.version === template.latest_version && <Badge tone="primary">{t("latestBadge")}</Badge>}
                <span className="flex-1 min-w-[160px] text-caption text-on-surface-muted">
                  {t("versionMeta", { date: date(v.created_at), projects: v.project_count, file: v.source_file_name })}
                  {v.published_by && <> · {v.published_by.name ? t("publishedBy", { name: v.published_by.name }) : t("publishedByFormer")}</>}
                </span>
                {isLead && v.status === "draft" && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(async () => onReview(await getTemplateVersion(orgId, template.id, v.version)))}>
                    {t("reviewAndPublish")}
                  </Button>
                )}
                {isLead && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm({ version: v.version, projects: v.project_count })}>
                    {t("deleteVersion")}
                  </Button>
                )}
              </div>
              {confirm?.version === v.version && (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-control bg-error-container px-3 py-2 text-on-error-container">
                  <p className="flex-1 min-w-[220px] text-body">{t("confirmVersion", { count: confirm.projects })}</p>
                  <Button size="sm" variant="danger" loading={busy} onClick={remove}>
                    {t("confirmDelete")}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>
                    {t("cancel")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

interface MappingReviewDialogProps {
  orgId: string;
  detail: TemplateVersionDetail;
  onClose: () => void;
  onPublished: () => void;
}

/** Lead rà mapping heading tự nhận của bản nháp rồi đăng — chỉ gửi heading đã đổi section. */
export function MappingReviewDialog({ orgId, detail, onClose, onPublished }: MappingReviewDialogProps) {
  const t = useTranslations("app.org.library.templates");
  const sectionOptions = useSectionOptions();
  const { busy, error, run } = useRunner();
  /** section đã đổi theo vị trí heading. */
  const [edits, setEdits] = useState<Record<number, string>>({});

  const publish = () =>
    void run(async () => {
      const headings: HeadingEdit[] = Object.entries(edits).map(([index, section_id]) => ({ index: Number(index), section_id }));
      await publishTemplateVersion(orgId, detail.template_id, detail.version, headings);
      onPublished();
    });

  return (
    <Modal open onClose={() => !busy && onClose()} title={t("reviewTitle", { name: detail.name, version: detail.version })} size="xl">
      <div className="flex flex-col gap-4">
        <ErrorLine message={error} />
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
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button loading={busy} onClick={publish}>
            {t("publish")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface NewTemplateDialogProps {
  orgId: string;
  onClose: () => void;
  /** Tải xong bản 1 (nháp) ⇒ trang mở hộp rà mapping để đăng. */
  onUploaded: (detail: TemplateVersionDetail) => void;
}

/** Lead tạo mẫu mới: đặt tên rồi chọn file .docx — BE tạo họ mẫu + bản 1 nháp với mapping tự nhận. */
export function NewTemplateDialog({ orgId, onClose, onUploaded }: NewTemplateDialogProps) {
  const t = useTranslations("app.org.library.templates");
  const nameId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const { busy, error, run } = useRunner();

  const upload = (file: File | undefined) => {
    if (!file) return;
    void run(async () => onUploaded(await uploadOrgTemplate(orgId, name.trim(), file)));
  };

  return (
    <Modal open onClose={() => !busy && onClose()} title={t("newTemplate")}>
      <div className="flex flex-col gap-4">
        <input
          ref={fileRef}
          type="file"
          accept=".docx"
          hidden
          aria-label={t("pickNewFile")}
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <label htmlFor={nameId} className="flex flex-col gap-1.5 text-caption font-bold text-on-surface-variant">
          {t("newNameLabel")}
          <input
            id={nameId}
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            className="h-10 rounded-control bg-surface-container-low px-3 text-body font-normal text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <ErrorLine message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={!name.trim()} loading={busy} onClick={() => fileRef.current?.click()}>
            {t("pickFile")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
