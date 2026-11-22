"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { createTemplateProposal } from "@/lib/api/org-library";
import { userErrorMessage } from "@/lib/api/error-messages";

/**
 * UC-85: Lead lưu cấu trúc dự án làm mẫu tổ chức bất cứ lúc nào (cùng luật đề xuất sau baseline: chỉ khung, AI đổi tên riêng - tốn
 * credit). Thành công ⇒ thẻ đề xuất hiện ở trên ô chat để Lead xem tên đã thay rồi lưu. Không lưu được (không có file nền, cấu trúc
 * đã có trong thư viện, từng bị bỏ…) ⇒ BE trả lý do, hiện nguyên câu đó.
 */
export default function SaveStructureEntry({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const t = useTranslations("app.org.templateProposal");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await createTemplateProposal(projectId);
      onCreated();
    } catch (err) {
      setMessage(userErrorMessage(err, t("createFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={t("saveStructureTitle")} className="flex flex-col gap-2 rounded-card bg-surface-container-low p-3">
      <p className="text-body font-bold text-on-surface">{t("saveStructureTitle")}</p>
      <p className="text-body text-on-surface-muted leading-[1.6]">{t("saveStructureBody")}</p>
      <Button size="sm" variant="secondary" className="self-start" loading={busy} onClick={() => void create()}>
        {t("saveStructure")}
      </Button>
      {message && (
        <p role="alert" className="text-body text-on-surface-muted">
          {message}
        </p>
      )}
    </section>
  );
}
