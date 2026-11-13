"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Flag } from "@/types/spine";
import { useDocVersions } from "../../hooks/mode1/useDocVersions";
import Mode1FlagsPanel from "./Mode1FlagsPanel";
import { crListHref, gapReportHref } from "./prefill";
import ReviewPackagePanel from "./ReviewPackagePanel";
import AutoPassedChip from "../AutoPassedChip";
import VersionsPanel from "./VersionsPanel";
import TemplateChangeEntry from "../template-migration/TemplateChangeEntry";
import { openMigrationMissing } from "../template-migration/missing-flags";
import type { OrgRole } from "@/types/organization";
import type { DocumentLanguage } from "@/types/project";
import type { TemplateCurrent } from "@/types/template-migration";

interface Mode1WorkspaceToolsProps {
  projectId: string;
  projectName?: string;
  flags: Flag[];
  /** Spine đổi ngoài luồng chat (release) — tải lại Spine/cờ/tài liệu. */
  onSpineChanged: () => void;
  /** Viewer: ẩn tạo CR, nhập SRS và release — vẫn xem cờ, CR, version và tải file. */
  readOnly?: boolean;
  /** Release = khoá baseline mới (UC-45): chỉ Lead — Analyst không thấy mục Release (BE cũng chặn 403). */
  canRelease?: boolean;
  /** FLF-330: vai trò trong org cho gói duyệt (Analyst gửi, Lead duyệt cả gói / yêu cầu sửa / phát hành). */
  orgRole?: OrgRole | null;
  /** Đổi giá trị ⇒ tải lại version + gói thay đổi (vd CR vừa ghi bản nháp mới ở khung chat). */
  refreshToken?: number;
  /** FLF-334 B: ngôn ngữ tài liệu — version có baseline tải được bằng ngôn ngữ còn lại. */
  documentLanguage?: DocumentLanguage | null;
  /** Mở hộp dịch sang `locale` cho snapshot của `version` (tải theo ngôn ngữ khác còn mục chưa dịch); bỏ trống ⇒ không mời dịch. */
  onTranslate?: (locale: DocumentLanguage, version: string) => void;
  /** Change request đang soạn ở khung chat (chưa ghi bản nháp) — khoá gửi duyệt / phát hành (xem `ReviewPackagePanel`). */
  crInProgress?: string | null;
  /** Tên mục dễ đọc theo `section_id` cho thẻ mục thiếu sau đổi mẫu. */
  sectionName?: (sectionId: string) => string;
  /** Đổi mẫu / hoàn tác xong: tải lại project (mẫu, ngôn ngữ, `template_update`) ngoài Spine / tài liệu. */
  onTemplateChanged?: () => void;
  /** Mẫu dự án đang theo (`template_current`) cho thẻ "Mẫu tài liệu"; `undefined` = project chưa tải. */
  templateCurrent?: TemplateCurrent | null;
}

/**
 * Cột công cụ của workspace mode 1 v3 (bám BPMN — plan `mode1-v3/phase-3-fe-mode1.md` 3.1): cờ đỏ + lối tạo CR, gap
 * report + change request, version & release (Flow 6). Không còn kế hoạch step / ký baseline v1 / waive.
 */
export default function Mode1WorkspaceTools({
  projectId,
  projectName,
  flags,
  onSpineChanged,
  readOnly = false,
  canRelease: _canRelease = false,
  orgRole = null,
  refreshToken = 0,
  documentLanguage = null,
  onTranslate,
  crInProgress = null,
  sectionName = (id) => id,
  onTemplateChanged,
  templateCurrent,
}: Mode1WorkspaceToolsProps) {
  const t = useTranslations("mode1.workspaceTools");
  const docs = useDocVersions(projectId, { refreshToken });
  const link = "px-2.5 py-1 rounded-full text-body font-bold bg-white border border-[#ECEAE5] text-[#4B4842] hover:bg-[#FAF9F7]";

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h4 className="text-body font-extrabold text-[#191817]">{t("flagsTitle")}</h4>
        <Mode1FlagsPanel projectId={projectId} flags={flags} readOnly={readOnly} />
      </section>

      {/* FLF-395: đổi sang mẫu khác (hai chiều), hoàn tác, mục thiếu sau đổi mẫu */}
      {!readOnly && (
        <TemplateChangeEntry projectId={projectId} orgRole={orgRole} flags={flags} sectionName={sectionName} refreshToken={refreshToken} onChanged={onTemplateChanged} current={templateCurrent} />
      )}

      <nav className="flex flex-wrap gap-1.5" aria-label={t("navAria")}>
        <Link href={gapReportHref(projectId)} scroll={false} className={link}>
          {t("gapReport")}
        </Link>
        <Link href={crListHref(projectId)} scroll={false} className={link}>
          {t("changeRequest")}
        </Link>
      </nav>

      {/* FLF-337: thay đổi AI tự qua (CR tự ghi ở mức "Chỉ ở mốc chốt") chưa xem — nhắc trước khi gửi gói / phát hành */}
      {!readOnly && <AutoPassedChip projectId={projectId} />}
      {/* FLF-330: gói duyệt kiểu pull request — gửi Lead / duyệt cả gói / yêu cầu sửa; mục Release cũ của VersionsPanel ẩn đi */}
      <ReviewPackagePanel
        projectId={projectId}
        refreshToken={refreshToken}
        role={readOnly ? "viewer" : orgRole}
        crInProgress={crInProgress}
        migrationMissing={openMigrationMissing(flags).length}
        onChanged={() => {
          void docs.reload();
          onSpineChanged();
        }}
      />

      <section className="flex flex-col gap-2">
        {docs.error && <p role="alert" className="text-body text-[#B03030]">{docs.error}</p>}
        <VersionsPanel
          projectId={projectId}
          projectName={projectName}
          versions={docs.versions}
          redOpen={docs.redOpen}
          readOnly={true}
          documentLanguage={documentLanguage}
          onTranslate={onTranslate}
          onReleased={() => {
            void docs.reload();
            onSpineChanged();
          }}
        />
      </section>
    </div>
  );
}
