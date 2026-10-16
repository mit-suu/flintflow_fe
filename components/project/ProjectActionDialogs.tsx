"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import { deleteProject, renameProject, setDocumentLanguage } from "@/lib/api/projects";
import { getTranslationStatus } from "@/lib/api/translations";
import type { TranslationStatus } from "@/types/document";
import type { DocumentLanguage, Project } from "@/types/project";
import { userErrorMessage } from "@/lib/api/error-messages";
import DocumentLanguagePicker from "./DocumentLanguagePicker";
import TranslateDialog from "./TranslateDialog";

export type ProjectAction = "rename" | "archive" | "delete" | "documentLanguage";

export interface ProjectActionTarget {
  action: ProjectAction;
  project: Project;
}

interface ProjectActionDialogsProps {
  target: ProjectActionTarget | null;
  onClose: () => void;
  /** Gọi sau khi BE xác nhận — trang tải lại danh sách. */
  onDone: () => void | Promise<void>;
  /** Hộp "Dịch tài liệu" (FLF-265) vừa trừ credit — trang tải lại số dư. */
  onCreditsSpent?: () => void;
}

/** Icon của mỗi thao tác xác nhận; chữ lấy từ `app.projectDialogs.<action>.*`. */
const CONFIRM_ICON: Record<Exclude<ProjectAction, "rename" | "documentLanguage">, IconName> = { archive: "archive", delete: "trash" };

/** Dialog thao tác trên card: đổi tên, đổi ngôn ngữ tài liệu (FLF-265), lưu trữ, xoá vĩnh viễn. */
export default function ProjectActionDialogs({ target, onClose, onDone, onCreditsSpent }: ProjectActionDialogsProps) {
  // `key` theo dự án + thao tác ⇒ mỗi lần mở là form mới (tên điền sẵn, không còn lỗi cũ)
  if (!target) return null;
  return <ActionDialog key={`${target.action}:${target.project._id}`} target={target} onClose={onClose} onDone={onDone} onCreditsSpent={onCreditsSpent} />;
}

function ActionDialog({ target, onClose, onDone, onCreditsSpent }: ProjectActionDialogsProps & { target: ProjectActionTarget }) {
  const t = useTranslations("app.projectDialogs");
  const tc = useTranslations("app.common");
  const { action, project } = target;
  const [name, setName] = useState(project.name);
  // Dự án cũ chưa có field ⇒ BE đọc `en` (D1)
  const currentLanguage: DocumentLanguage = project.documentLanguage ?? "en";
  const [language, setLanguage] = useState<DocumentLanguage>(currentLanguage);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Đổi ngôn ngữ xong mà nội dung cũ còn mục chưa dịch ⇒ hộp chuyển sang "Dịch tài liệu" với ước tính vừa đọc (phase 1 §1.7). */
  const [translateStatus, setTranslateStatus] = useState<TranslationStatus | null>(null);

  const close = () => {
    if (!submitting) onClose();
  };

  const run = async (call: () => Promise<unknown>, failed: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await call();
      await onDone();
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, failed));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Đổi ngôn ngữ rồi đọc ước tính dịch (không gọi model): còn mục chưa dịch ⇒ mở "Dịch tài liệu" ngay, không ⇒ đóng.
   * Ngôn ngữ đã đổi thì không đọc được ước tính cũng chỉ đóng — cảnh báo "N mục chưa dịch" trong workspace vẫn mời dịch.
   */
  const changeLanguage = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await setDocumentLanguage(project._id, language);
      await onDone();
    } catch (err) {
      setError(userErrorMessage(err, t("documentLanguage.failed")));
      setSubmitting(false);
      return;
    }
    const status = await getTranslationStatus(project._id).then((res) => res.data, () => null);
    setSubmitting(false);
    if (status && status.missing > 0) setTranslateStatus(status);
    else onClose();
  };

  const errorBox = error && (
    <p role="alert" className="text-body text-on-error-container bg-error-container border border-error-border rounded-control px-3 py-2">
      {error}
    </p>
  );

  if (translateStatus) {
    return (
      <TranslateDialog
        projectId={project._id}
        open
        initialStatus={translateStatus}
        onClose={onClose}
        onDone={({ creditsUsed }) => {
          if (creditsUsed > 0) onCreditsSpent?.();
        }}
      />
    );
  }

  if (action === "rename") {
    return (
      <Modal open onClose={close} title={t("renameTitle")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void run(() => renameProject(project._id, name.trim()), t("renameFailed"));
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rename-project" className="text-body font-bold text-on-surface-medium">
              {t("renameLabel")}
            </label>
            <input
              id="rename-project"
              autoFocus
              type="text"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              className="h-10 px-3.5 rounded-control border border-outline bg-surface-container-low text-body text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          {errorBox}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={submitting}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={submitting} disabled={!name.trim() || name.trim() === project.name}>
              {t("saveChanges")}
            </Button>
          </div>
        </form>
      </Modal>
    );
  }

  if (action === "documentLanguage") {
    return (
      <Modal open onClose={close} title={t("documentLanguage.title")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (language !== currentLanguage) void changeLanguage();
          }}
          className="flex flex-col gap-4"
        >
          <DocumentLanguagePicker value={language} onChange={setLanguage} disabled={submitting} />
          <p className="text-body text-on-surface-variant leading-[1.55]">{t("documentLanguage.detail")}</p>
          {errorBox}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={submitting}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={submitting} disabled={language === currentLanguage}>
              {submitting ? t("documentLanguage.busy") : t("documentLanguage.cta")}
            </Button>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal open onClose={close} title={t(`${action}.title`)}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 bg-error-container border border-error-border rounded-control p-4 text-on-error-container">
          <Icon name={CONFIRM_ICON[action]} size={20} className="mt-0.5" />
          <div>
            <p className="text-body font-bold text-on-surface">
              {t("confirm", { action: t(`${action}.question`), name: project.name })}
            </p>
            <p className="text-body mt-1 leading-[1.55]">{t(`${action}.detail`)}</p>
          </div>
        </div>
        {errorBox}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button
            variant="danger"
            loading={submitting}
            onClick={() => void run(() => deleteProject(project._id, { hard: action === "delete" }), t(`${action}.failed`))}
          >
            {submitting ? t(`${action}.busy`) : t(`${action}.cta`)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
