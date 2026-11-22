"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import type { TemplateProposal } from "@/types/org-library";

/**
 * Nội dung một đề xuất mẫu (UC-85 / UC-88): mọi tên riêng AI đã thay (gốc ⇒ chỗ trống, hoặc mục bị bỏ kèm lý do) và cấu trúc khung.
 * Dùng chung cho thẻ trong dự án và hộp duyệt của Lead.
 */
export default function TemplateProposalDetails({ proposal, headingsOpen = false }: { proposal: TemplateProposal; headingsOpen?: boolean }) {
  const t = useTranslations("app.org.templateProposal");
  const [showHeadings, setShowHeadings] = useState(headingsOpen);

  return (
    <div className="flex flex-col gap-3">
      {proposal.replaced_names.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-caption font-bold text-on-surface-muted">{t("replacedTitle", { count: proposal.replaced_names.length })}</p>
          <ul className="flex flex-col gap-1">
            {proposal.replaced_names.map((r) => (
              <li key={r.key} className="rounded-control bg-surface-container-lowest px-3 py-2 text-body text-on-surface">
                <span className="text-on-surface-muted line-through">{r.original}</span>
                {r.generic !== null ? (
                  <span>
                    {" "}
                    <span aria-hidden>→</span> <span className="font-semibold">{r.generic}</span>
                  </span>
                ) : (
                  <span className="block text-caption text-on-surface-muted">{r.reason ? t("droppedReason", { reason: r.reason }) : t("dropped")}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-body text-on-surface-muted">{t("noReplaced")}</p>
      )}
      <div className="flex flex-col gap-1.5">
        <Button size="sm" variant="ghost" className="self-start" aria-expanded={showHeadings} onClick={() => setShowHeadings((v) => !v)}>
          {showHeadings ? t("hideStructure") : t("showStructure", { count: proposal.headings.length })}
        </Button>
        {showHeadings && (
          <ol className="flex flex-col gap-0.5 rounded-control bg-surface-container-lowest px-3 py-2 text-body text-on-surface">
            {proposal.headings.map((h, i) => (
              <li key={`${i}-${h}`}>{h}</li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
