"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { decideTemplateProposal, getOrgTemplateProposal, listTemplateProposals } from "@/lib/api/org-library";
import { userErrorMessage } from "@/lib/api/error-messages";
import type { TemplateProposal } from "@/types/org-library";
import TemplateProposalDetails from "./template-proposal-details";

/** Đề xuất mở thẳng từ thông báo: `/home/library?proposal=<id>`. Đọc một lần lúc vào trang. */
const proposalFromUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("proposal");
};

/**
 * UC-88 (chỉ Lead): đề xuất mẫu Analyst gửi từ dự án đang chờ duyệt. Mở một đề xuất ⇒ xem tên riêng AI đã thay + cấu trúc khung,
 * Approve (mẫu vào thư viện, dự án nguồn theo mẫu) hoặc Reject (dự án tiếp tục không có mẫu, cùng cấu trúc không đề xuất lại).
 * Không có đề xuất nào và không mở từ thông báo ⇒ không hiện gì.
 */
export default function TemplateProposalsSection({ orgId, onDecided }: { orgId: string; onDecided: () => void }) {
  const t = useTranslations("app.org.templateProposal");
  const format = useFormatter();
  const [items, setItems] = useState<TemplateProposal[]>([]);
  const [open, setOpen] = useState<TemplateProposal | null>(null);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const reload = useCallback(() => {
    listTemplateProposals(orgId)
      .then(setItems)
      .catch(() => setItems([]));
  }, [orgId]);

  useEffect(() => {
    reload();
    const fromUrl = proposalFromUrl();
    if (!fromUrl) return;
    let cancelled = false;
    getOrgTemplateProposal(orgId, fromUrl)
      .then((p) => !cancelled && setOpen(p))
      .catch((err) => !cancelled && setResult(userErrorMessage(err, t("loadFailed"))));
    return () => {
      cancelled = true;
    };
  }, [orgId, reload, t]);

  const decide = async (decision: "approve" | "reject") => {
    if (!open) return;
    setBusy(decision);
    setError(null);
    try {
      await decideTemplateProposal(orgId, open.id, decision);
      setResult(decision === "approve" ? t("approvedNotice", { project: open.project_name }) : t("rejectedNotice", { project: open.project_name }));
      setOpen(null);
      reload();
      onDecided();
    } catch (err) {
      setError(userErrorMessage(err, t("actionFailed")));
    } finally {
      setBusy(null);
    }
  };

  if (!items.length && !open && !result) return null;
  // Mở từ thông báo một đề xuất đã có người quyết ⇒ hộp chỉ để xem, không còn nút duyệt
  const decidable = open?.status === "sent";

  return (
    <section aria-label={t("sectionTitle")} className="flex flex-col gap-2 rounded-card bg-surface-container-low p-4">
      <h2 className="text-heading font-bold text-on-surface">{t("sectionTitle")}</h2>
      {result && (
        <p role="status" className="text-body text-on-surface">
          {result}
        </p>
      )}
      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-control bg-surface-container-lowest px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-on-surface truncate">{t("rowTitle", { project: p.project_name })}</p>
                <p className="text-caption text-on-surface-muted">
                  {t("rowMeta", {
                    name: p.created_by.name ?? "-",
                    date: format.dateTime(new Date(p.created_at), { day: "numeric", month: "numeric", year: "numeric" }),
                  })}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setOpen(p)}>
                {t("review")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-on-surface-muted">{t("noneWaiting")}</p>
      )}

      <Modal open={open !== null} onClose={() => setOpen(null)} title={open ? t("rowTitle", { project: open.project_name }) : ""} size="lg">
        {open && (
          <div className="flex flex-col gap-4">
            <p className="text-body text-on-surface-muted leading-[1.6]">{decidable ? t("reviewBody") : t("alreadyDecided")}</p>
            <TemplateProposalDetails proposal={open} headingsOpen />
            {error && (
              <p role="alert" className="text-body text-on-error-container">
                {error}
              </p>
            )}
            {decidable && (
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" loading={busy === "reject"} disabled={busy !== null} onClick={() => void decide("reject")}>
                  {t("reject")}
                </Button>
                <Button loading={busy === "approve"} disabled={busy !== null} onClick={() => void decide("approve")}>
                  {t("approve")}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
