"use client";

import { useTranslations } from "next-intl";
import type { Flag } from "@/types/spine";
import Mode1FlagsPanel from "./Mode1FlagsPanel";
import ReviewPackagePanel from "./ReviewPackagePanel";
import AutoPassedChip from "../AutoPassedChip";
import TemplateChangeEntry from "../template-migration/TemplateChangeEntry";
import { openMigrationMissing } from "../template-migration/missing-flags";
import type { TemplateChangeAvailability } from "../template-migration/useTemplateChangeAvailability";
import type { OrgRole } from "@/types/organization";

interface Mode1WorkspaceToolsProps {
  projectId: string;
  flags: Flag[];
  /** Spine đổi ngoài luồng chat (release, gửi gói) — tải lại Spine/cờ/tài liệu/version. */
  onSpineChanged: () => void;
  /** Viewer: ẩn gửi gói / release và đổi mẫu — vẫn xem cờ và gói thay đổi. */
  readOnly?: boolean;
  /** FLF-330: vai trò trong org cho gói duyệt (Analyst gửi, Lead duyệt cả gói / yêu cầu sửa / phát hành). */
  orgRole?: OrgRole | null;
  /** Đổi giá trị ⇒ tải lại gói thay đổi (vd CR vừa ghi bản nháp mới ở khung chat). */
  refreshToken?: number;
  /** Tên mục dễ đọc theo `section_id` cho thẻ mục thiếu sau đổi mẫu. */
  sectionName?: (sectionId: string) => string;
  /** Hoàn tác / khôi phục đổi mẫu xong: tải lại project (mẫu, ngôn ngữ, `template_update`) ngoài Spine / tài liệu. */
  onTemplateChanged?: () => void;
  /** Trạng thái đổi mẫu (dùng chung với menu ⋯ của header); bỏ trống ⇒ không có thẻ trạng thái đổi mẫu. */
  templateAvailability?: TemplateChangeAvailability;
}

/**
 * Panel "Kiểm & chốt" của workspace mode 1: cờ, thay đổi AI tự qua, gói thay đổi gửi Lead (Flow 6), thẻ trạng thái đổi mẫu
 * khi có việc. Gap report / Change request ở header; version ở chip version của tài liệu; tài liệu ở nút "Tài liệu" của chat.
 */
export default function Mode1WorkspaceTools({
  projectId,
  flags,
  onSpineChanged,
  readOnly = false,
  orgRole = null,
  refreshToken = 0,
  sectionName = (id) => id,
  onTemplateChanged,
  templateAvailability,
}: Mode1WorkspaceToolsProps) {
  const t = useTranslations("mode1.workspaceTools");

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h4 className="text-body font-extrabold text-on-surface">{t("flagsTitle")}</h4>
        <Mode1FlagsPanel projectId={projectId} flags={flags} readOnly={readOnly} />
      </section>

      {/* FLF-395: lần đổi mẫu kẹt, hoàn tác, mục thiếu sau đổi mẫu — lối vào "Đổi mẫu" ở menu ⋯ của header */}
      {!readOnly && templateAvailability && (
        <TemplateChangeEntry projectId={projectId} availability={templateAvailability} flags={flags} sectionName={sectionName} onChanged={onTemplateChanged} />
      )}

      {/* FLF-337: thay đổi AI tự qua (CR tự ghi ở mức "Chỉ ở mốc chốt") chưa xem — nhắc trước khi gửi gói / phát hành */}
      {!readOnly && <AutoPassedChip projectId={projectId} />}
      {/* FLF-330: gói duyệt kiểu pull request — gửi Lead / duyệt cả gói / yêu cầu sửa */}
      <ReviewPackagePanel
        projectId={projectId}
        refreshToken={refreshToken}
        role={readOnly ? "viewer" : orgRole}
        migrationMissing={openMigrationMissing(flags).length}
        onChanged={onSpineChanged}
      />
    </div>
  );
}
