"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { DocumentLanguage } from "@/types/project";
import { useDocVersions } from "../../hooks/mode1/useDocVersions";
import { compareHref } from "./prefill";
import VersionsPanel from "./VersionsPanel";

interface Mode1VersionsMenuProps {
  projectId: string;
  projectName?: string;
  projectCode?: string;
  /** Ngôn ngữ tài liệu — version có baseline tải được bằng ngôn ngữ còn lại (FLF-334 B). */
  documentLanguage?: DocumentLanguage | null;
  /** Mở hộp dịch khi tải theo ngôn ngữ khác còn mục chưa dịch; bỏ trống ⇒ chỉ báo số mục. */
  onTranslate?: (locale: DocumentLanguage, version: string) => void;
  /** Đóng popup (sau khi bấm "So sánh version"). */
  onClose: () => void;
}

/**
 * Popup của chip version ở thanh đầu tài liệu (mode 1): danh sách version kèm tải về (bản sạch / Track Changes / PDF / file gốc
 * / ngôn ngữ khác) và lối vào "So sánh version". Tải danh sách lúc mở. Release vẫn đi qua gói thay đổi ở panel Kiểm & chốt.
 */
export default function Mode1VersionsMenu({ projectId, projectName, projectCode, documentLanguage = null, onTranslate, onClose }: Mode1VersionsMenuProps) {
  const t = useTranslations("workspace.document");
  const docs = useDocVersions(projectId, { redFlags: false });

  return (
    <div className="flex flex-col gap-3">
      {/* Tiêu đề "Các version" có sẵn trong VersionsPanel — ở đây chỉ thêm lối vào So sánh */}
      <div className="flex items-center justify-end">
        <Link
          href={compareHref(projectId)}
          scroll={false}
          onClick={onClose}
          className="inline-flex items-center gap-1 text-body font-bold text-primary hover:underline"
        >
          {t("compareVersions")}
          <Icon name="arrow-right" size={13} />
        </Link>
      </div>
      {docs.error && (
        <p role="alert" className="text-body text-error">
          {docs.error}
        </p>
      )}
      {docs.loading ? (
        <p className="text-body text-on-surface-muted">{t("versionsLoading")}</p>
      ) : (
        <VersionsPanel
          projectId={projectId}
          projectName={projectName}
          projectCode={projectCode}
          versions={docs.versions}
          redOpen={docs.redOpen}
          readOnly
          documentLanguage={documentLanguage}
          onTranslate={onTranslate}
          onReleased={() => void docs.reload()}
        />
      )}
    </div>
  );
}
