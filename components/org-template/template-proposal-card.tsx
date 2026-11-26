"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { actOnTemplateProposal, chatOnTemplateProposal, getTemplateProposal, type ProposalAction } from "@/lib/api/org-library";
import { userErrorMessage } from "@/lib/api/error-messages";
import type { OrgRole } from "@/types/organization";
import type { TemplateProposal } from "@/types/org-library";
import TemplateProposalDetails from "./template-proposal-details";

interface TemplateProposalCardProps {
  projectId: string;
  orgRole: OrgRole | null;
  /** Đổi giá trị ⇒ đọc lại (baseline / bản phát hành vừa tạo đề xuất, hoặc Lead vừa bấm lưu cấu trúc). */
  refreshToken?: number;
  /** Lead lưu xong ⇒ dự án theo mẫu mới, workspace đọc lại dự án. */
  onSaved?: () => void;
  className?: string;
}

/**
 * UC-85: thẻ "Lưu cấu trúc này thành mẫu của tổ chức?" sau baseline - chỉ tác giả baseline thấy (BE lọc). Analyst gửi Lead duyệt,
 * Lead lưu thẳng vào thư viện, ai cũng có thể không lưu. Đã gửi ⇒ còn một dòng "đang chờ Lead duyệt". Không có đề xuất hoặc tải
 * lỗi ⇒ không hiện gì (không làm phiền workspace).
 */
export default function TemplateProposalCard({ projectId, orgRole, refreshToken = 0, onSaved, className }: TemplateProposalCardProps) {
  const t = useTranslations("app.org.templateProposal");
  const [proposal, setProposal] = useState<TemplateProposal | null>(null);
  const [busy, setBusy] = useState<ProposalAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"saved" | "declined" | null>(null);
  const [message, setMessage] = useState("");
  const [chatting, setChatting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTemplateProposal(projectId)
      .then((p) => {
        if (cancelled) return;
        setProposal(p);
        setDone(null);
      })
      .catch(() => !cancelled && setProposal(null));
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshToken]);

  if (done) {
    return (
      <p role="status" className={`rounded-card bg-surface-container-low px-3 py-2 text-body text-on-surface ${className ?? ""}`}>
        {done === "saved" ? t("savedNotice") : t("declinedNotice")}
      </p>
    );
  }
  if (!proposal) return null;

  const act = async (action: ProposalAction) => {
    setBusy(action);
    setError(null);
    try {
      const next = await actOnTemplateProposal(projectId, action);
      if (action === "send") setProposal(next);
      else {
        setProposal(null);
        setDone(action === "save" ? "saved" : "declined");
        if (action === "save") onSaved?.();
      }
    } catch (err) {
      setError(userErrorMessage(err, t("actionFailed")));
    } finally {
      setBusy(null);
    }
  };

  // FLF-466: sửa đề xuất bằng một câu chat (AI sửa lại danh sách chỗ đổi, tốn credit); chỉ Lead / Analyst
  const canEdit = orgRole === "lead" || orgRole === "analyst";
  const sendChat = async () => {
    const text = message.trim();
    if (!text) return;
    setChatting(true);
    setError(null);
    try {
      setProposal(await chatOnTemplateProposal(projectId, text));
      setMessage("");
    } catch (err) {
      setError(userErrorMessage(err, t("chatFailed")));
    } finally {
      setChatting(false);
    }
  };

  if (proposal.status === "sent") {
    return (
      <p role="status" className={`rounded-card bg-surface-container-low px-3 py-2 text-body text-on-surface-muted ${className ?? ""}`}>
        {t("sentNotice")}
      </p>
    );
  }

  return (
    <section aria-label={t("cardTitle")} className={`rounded-card bg-surface-container-low p-3 flex flex-col gap-3 ${className ?? ""}`}>
      <div>
        <h2 className="text-body font-bold text-on-surface">{t("cardTitle")}</h2>
        <p className="text-body text-on-surface-muted mt-0.5 leading-[1.6]">{t("cardBody")}</p>
      </div>
      <TemplateProposalDetails proposal={proposal} />
      {canEdit && (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void sendChat();
          }}
        >
          <label htmlFor="proposal-chat" className="text-caption font-bold text-on-surface-muted">
            {t("chatLabel")}
          </label>
          <textarea
            id="proposal-chat"
            rows={2}
            maxLength={500}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("chatPlaceholder")}
            className="w-full px-3 py-2 rounded-control bg-surface-container-lowest border border-outline-variant text-body outline-none resize-none"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption text-on-surface-muted">{t("chatCost")}</span>
            <Button type="submit" size="sm" variant="secondary" loading={chatting} disabled={busy !== null || chatting || message.trim().length === 0}>
              {t("chatSend")}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-body text-on-error-container">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {orgRole === "lead" && (
          <Button size="sm" loading={busy === "save"} disabled={busy !== null} onClick={() => void act("save")}>
            {t("saveToLibrary")}
          </Button>
        )}
        {orgRole === "analyst" && (
          <Button size="sm" loading={busy === "send"} disabled={busy !== null} onClick={() => void act("send")}>
            {t("sendToLead")}
          </Button>
        )}
        <Button size="sm" variant="secondary" loading={busy === "decline"} disabled={busy !== null} onClick={() => void act("decline")}>
          {t("dontSave")}
        </Button>
      </div>
    </section>
  );
}
