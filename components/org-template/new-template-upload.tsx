"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { userErrorMessage } from "@/lib/api/error-messages";
import { publishTemplateVersion, uploadOrgTemplate } from "@/lib/api/org-library";
import type { HeadingEdit, TemplateVersionDetail } from "@/types/org-library";
import TemplateVersionReview from "./template-version-review";

interface NewTemplateUploadProps {
  orgId: string;
  /** Bản vừa đăng (đã có trong thư viện). */
  onPublished: (detail: TemplateVersionDetail) => void;
  onCancel: () => void;
}

/**
 * FLF-412 — Lead tải một mẫu mới lên thư viện ngay trong hộp Tạo dự án: đặt tên + chọn file ⇒ rà mapping (có cảnh báo khi file
 * còn chữ cũ) ⇒ đăng. Cùng API và màn rà như trang Thư viện mẫu; BE vẫn kiểm quyền Lead.
 */
export default function NewTemplateUpload({ orgId, onPublished, onCancel }: NewTemplateUploadProps) {
  const t = useTranslations("app.org.library.templates");
  const nameId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateVersionDetail | null>(null);

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

  const upload = (file: File | undefined) => {
    if (!file) return;
    void run(async () => setDraft(await uploadOrgTemplate(orgId, name.trim(), file)));
  };

  const publish = (headings: HeadingEdit[]) => {
    if (!draft) return;
    void run(async () => onPublished(await publishTemplateVersion(orgId, draft.template_id, draft.version, headings)));
  };

  return (
    <div className="flex flex-col gap-3">
      <input ref={fileRef} type="file" accept=".docx" hidden aria-label={t("pickNewFile")} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      {draft ? (
        <TemplateVersionReview detail={draft} busy={busy} onPublish={publish} onCancel={onCancel} />
      ) : (
        <div className="flex flex-wrap items-end gap-3 rounded-card bg-surface-container-low p-3">
          <label htmlFor={nameId} className="flex flex-col gap-1 text-caption font-bold text-on-surface-variant">
            {t("newNameLabel")}
            <input
              id={nameId}
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-[260px] max-w-full rounded-control bg-surface-container-lowest px-3 text-body font-normal text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <Button size="sm" disabled={!name.trim() || busy} loading={busy} onClick={() => fileRef.current?.click()}>
            {t("pickFile")}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
            {t("cancel")}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      )}
    </div>
  );
}
