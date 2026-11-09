"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { saveImportToOrg } from "@/lib/api/org-library";

interface SaveOrgTemplateCardProps {
  projectId: string;
  /** Tên gợi ý — tên file mẫu bỏ đuôi `.docx`. */
  defaultName: string;
}

/** FLF-278 trên FLF-335/336: lưu file mẫu + mapping đã xác nhận để dự án sau của tổ chức chọn lại, không phải tải và map lại. */
export default function SaveOrgTemplateCard({ projectId, defaultName }: SaveOrgTemplateCardProps) {
  const t = useTranslations("workspace.import.saveToOrg");
  const inputId = useId();
  const [name, setName] = useState(defaultName);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  const save = async () => {
    setState("saving");
    try {
      await saveImportToOrg(projectId, name.trim());
      setState("saved");
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="bg-surface-container-low rounded-card p-4 flex flex-col gap-2">
      <p className="text-body text-on-surface-variant">{t("help")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={inputId} className="flex flex-col gap-1 text-caption font-bold text-on-surface-medium">
          {t("nameLabel")}
          <input
            id={inputId}
            value={name}
            maxLength={120}
            disabled={state === "saving" || state === "saved"}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-[260px] max-w-full rounded-control bg-surface-container-lowest px-3 text-body font-normal text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <Button variant="secondary" size="sm" disabled={!name.trim() || state === "saved"} loading={state === "saving"} onClick={() => void save()}>
          {state === "saving" ? t("saving") : t("action")}
        </Button>
      </div>
      {state === "saved" && (
        <p role="status" className="text-caption text-success">
          {t("saved")}
        </p>
      )}
      {state === "failed" && (
        <p role="alert" className="text-caption text-on-error-container">
          {t("failed")}
        </p>
      )}
    </div>
  );
}
