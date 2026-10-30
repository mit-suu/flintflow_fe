"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { saveImportToOrg } from "@/lib/api/org-library";

interface SaveOrgTemplateCardProps {
  projectId: string;
  /** Tên gợi ý — tên file mẫu bỏ đuôi `.docx`. */
  defaultName: string;
}

/** FLF-278 trên FLF-335/336: lưu file mẫu + mapping đã xác nhận để dự án sau của tổ chức chọn lại, không phải tải và map lại. */
export default function SaveOrgTemplateCard({ projectId, defaultName }: SaveOrgTemplateCardProps) {
  const t = useTranslations("mode1.importWizard.saveToOrg");
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
    <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-4 flex flex-col gap-2">
      <p className="text-body text-[#4B4842]">{t("help")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={inputId} className="flex flex-col gap-1 text-caption font-bold text-[#4B4842]">
          {t("nameLabel")}
          <input
            id={inputId}
            value={name}
            maxLength={120}
            disabled={state === "saving" || state === "saved"}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-[260px] rounded-[8px] border border-[#E4E1DC] bg-[#FAF9F7] px-2 text-body font-normal text-[#191817]"
          />
        </label>
        <button
          type="button"
          disabled={!name.trim() || state === "saving" || state === "saved"}
          onClick={() => void save()}
          className="px-4 py-2 rounded-[10px] border border-[#ECEAE5] bg-white text-[#191817] text-body font-bold cursor-pointer disabled:opacity-50"
        >
          {state === "saving" ? t("saving") : t("action")}
        </button>
      </div>
      {state === "saved" && (
        <p role="status" className="text-caption text-[#1F7A45]">
          {t("saved")}
        </p>
      )}
      {state === "failed" && (
        <p role="alert" className="text-caption text-[#B03030]">
          {t("failed")}
        </p>
      )}
    </div>
  );
}
