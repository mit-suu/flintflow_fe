"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import type { OrgRole } from "@/types/organization";
import type { Flag } from "@/types/spine";
import type { TemplateCurrent } from "@/types/template-migration";
import { readMigrationTarget } from "./href";
import TemplateMigrationScreen from "./TemplateMigrationScreen";

interface TemplateMigrationPopupProps {
  projectId: string;
  orgId: string | null;
  orgRole: OrgRole | null;
  flags: readonly Flag[];
  sectionName: (sectionId: string) => string;
  /** Viewer không đổi mẫu được — popup không dựng. */
  readOnly?: boolean;
  /** Lần đổi mẫu đổi trạng thái (bắt đầu / huỷ / áp dụng / hoàn tác / khôi phục): tài liệu, cờ, project cần đọc lại. */
  onChanged?: () => void;
  /** Mẫu + bản dự án đang theo — truyền xuống bước chọn mẫu. */
  current?: TemplateCurrent | null;
}

/**
 * Popup đổi mẫu, mở bằng query `panel=template` (+ `template_id` / `version` điền sẵn từ thông báo bản mới). Tách khỏi `Mode1Popup`
 * để dự án mode 2 đã có baseline cũng đổi mẫu được mà không mở nhầm gap report / change request.
 */
export default function TemplateMigrationPopup({ projectId, orgId, orgRole, flags, sectionName, readOnly = false, onChanged, current = null }: TemplateMigrationPopupProps) {
  const t = useTranslations("mode1.popup");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  if (params?.get("panel") !== "template" || readOnly) return null;
  const close = () => router.replace(pathname ?? `/projects/${projectId}`, { scroll: false });
  return (
    <Modal open onClose={close} title={t("templateTitle")} size="xl">
      <TemplateMigrationScreen
        projectId={projectId}
        orgId={orgId}
        orgRole={orgRole}
        flags={flags}
        sectionName={sectionName}
        preselect={readMigrationTarget(new URLSearchParams(params.toString()))}
        onChanged={onChanged}
        currentTemplate={current}
      />
    </Modal>
  );
}
