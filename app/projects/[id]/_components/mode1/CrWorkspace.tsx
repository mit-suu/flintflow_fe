"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CR_TERMINAL_STATUSES, type CrDetail, type CrLocation } from "@/types/change-request";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { useChangeRequest } from "../../hooks/mode1/useChangeRequest";
import ChangeGroupPanel from "./ChangeGroupPanel";
import ClarifyPanel from "./ClarifyPanel";
import CrTimeline from "./CrTimeline";
import ImpactList from "./ImpactList";
import { CR_SOURCE_LABELS, CR_STATUS_LABELS, formatDateTime } from "./labels";
import PausedBanner from "./PausedBanner";
import ReasonDialog from "./ReasonDialog";

/** Vị trí AI cần (đề xuất lại): chưa kết luận, hoặc kiểm trượt mà không phải sửa tay — cùng luật `needsProposal` BE. */
export const needsProposal = (l: CrLocation): boolean => !l.manual && (l.conclusion === null || (l.verify !== null && !l.verify.code_ok));

/** Trạng thái BE cho phép sửa tay vị trí (`location.service`). */
const EDITABLE = ["impact_review", "proposing", "manual_fix", "ready_to_submit"] as const;

const PAUSED_WHAT: Partial<Record<CrDetail["change_request"]["status"], string>> = {
  clarifying: "Làm rõ",
  proposing: "Đề xuất sửa",
  verifying: "Kiểm đề xuất",
};

interface CrWorkspaceProps {
  projectId: string;
  crId: string;
  /** Sau bước có thể đổi credit / version (header). */
  onChanged?: () => void;
}

/**
 * Workspace một change request (3.1–3.14): mọi nút hành động chọn theo `status` BE trả. Bước AI (làm rõ, đề
 * xuất, kiểm) chạy đồng bộ; hết credit / lỗi AI ⇒ CR `paused` + nút tiếp tục.
 */
export default function CrWorkspace({ projectId, crId, onChanged }: CrWorkspaceProps) {
  const cr = useChangeRequest(projectId, crId);
  const [dialog, setDialog] = useState<"cancel" | "close" | null>(null);

  if (cr.loading) return <PageSkeleton rows={2} label="Đang tải change request" />;
  if (!cr.detail) {
    return (
      <div role="alert" className="bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] rounded-[12px] px-4 py-3 text-[12.5px]">
        {cr.error ?? "Không tìm thấy change request"}
      </div>
    );
  }

  const { change_request: c, locations, groups, pending_questions } = cr.detail;
  const busy = cr.busy !== null;
  const after = (p: Promise<boolean>) => void p.then((ok) => ok && onChanged?.());
  const terminal = CR_TERMINAL_STATUSES.includes(c.status);
  const allRejected = groups.length > 0 && groups.every((g) => g.decision === "rejected");

  const primary = (label: string, onClick: () => void, busyLabel = "Đang chạy…") => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="px-4 py-2 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold disabled:opacity-50 cursor-pointer"
    >
      {busy ? busyLabel : label}
    </button>
  );

  /** Việc tiếp theo theo trạng thái — không suy diễn gì ngoài dữ liệu BE trả. */
  let next: ReactNode = null;
  if (c.paused) {
    next = <PausedBanner paused={c.paused} what={PAUSED_WHAT[c.status] ?? "Bước AI"} busy={cr.busy === "resume"} onResume={() => after(cr.action("resume"))} />;
  } else if (c.status === "draft" || c.status === "clarifying") {
    next = (
      <Step text="AI đọc yêu cầu và hỏi lại nếu còn mơ hồ (tốn credit).">
        {primary("Bắt đầu làm rõ (AI)", () => after(cr.action("clarify")), "AI đang làm rõ…")}
      </Step>
    );
  } else if (c.status === "impact_review" && locations.length === 0) {
    next = (
      <Step text="Tìm tất định mọi block liên quan (liên kết field, mã được nhắc, từ khoá) và khoá chúng cho CR này — không tốn credit.">
        {primary("Tìm vị trí ảnh hưởng & khoá", () => after(cr.action("impact")), "Đang tìm…")}
      </Step>
    );
  } else if (c.status === "impact_review" || (c.status === "proposing" && locations.some(needsProposal))) {
    const redo = locations.some((l) => l.verify && !l.verify.code_ok);
    // AI đã chạy mà còn vị trí chưa kết luận (model bỏ sót) ⇒ nói rõ, cho chọn chạy lại hoặc sửa tay
    const missed = c.status === "proposing" && !redo ? locations.filter((l) => l.conclusion === null).length : 0;
    const text = redo
      ? "Một số đề xuất trượt kiểm — AI đề xuất lại các vị trí đó (tối đa 2 lần)."
      : missed > 0 && missed < locations.length
        ? `AI chưa kết luận ${missed} vị trí. Bấm chạy lại, hoặc dùng "Sửa tay" ở từng vị trí bên dưới để tự kết luận.`
        : "AI đề xuất cho từng vị trí: sửa, chỉ comment, hoặc không liên quan kèm lý do (tốn credit).";
    next = (
      <Step text={text}>
        {primary(redo ? "AI làm lại vị trí trượt" : "AI đề xuất sửa", () => after(cr.action("propose")), "AI đang đề xuất…")}
      </Step>
    );
  } else if (c.status === "proposing" || c.status === "verifying") {
    next = (
      <Step text="Kiểm code (old text khớp, luật Spine, cờ đỏ mới) và AI soát nhất quán (chỉ cờ vàng).">
        {primary("Kiểm đề xuất", () => after(cr.action("verify")), "Đang kiểm…")}
      </Step>
    );
  } else if (c.status === "manual_fix") {
    next = (
      <Step tone="warn" text="AI đã làm lại 2 lần mà vẫn trượt kiểm. Sửa tay các vị trí trượt bên dưới rồi kiểm lại, hoặc huỷ change request.">
        {primary("Kiểm lại", () => after(cr.action("verify")), "Đang kiểm…")}
      </Step>
    );
  } else if (c.status === "ready_to_submit") {
    next = (
      <Step text="Mọi vị trí đã có kết luận và đạt kiểm. Nộp để duyệt từng nhóm thay đổi.">
        {primary("Nộp để duyệt", () => after(cr.action("submit")), "Đang nộp…")}
      </Step>
    );
  } else if (c.status === "in_review") {
    next = allRejected ? (
      <Step tone="warn" text="Mọi nhóm đều bị từ chối. Sửa lại CR (khoá lại block, AI đề xuất lại) hoặc đóng CR.">
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => setDialog("close")} className="px-4 py-2 rounded-[10px] border border-[#F2CACA] bg-white text-[13px] font-bold text-[#B03030] disabled:opacity-50">
            Đóng CR
          </button>
          {primary("Sửa lại CR", () => after(cr.action("revise")), "Đang khoá lại…")}
        </div>
      </Step>
    ) : (
      <Step text="Duyệt hoặc từ chối từng nhóm. Nhóm cuối được quyết mà có nhóm duyệt ⇒ ghi Track Changes thành bản nháp mới." />
    );
  } else if (c.status === "written") {
    next = (
      <Step tone="ok" text={`Đã ghi Track Changes + comment (tác giả ${c.cr_id}) vào bản ${c.result_doc_version ?? "mới"}.`}>
        <Link href={`/projects/${projectId}`} className="px-4 py-2 rounded-[10px] bg-[#1F7A45] text-white text-[13px] font-bold">
          Xem tài liệu
        </Link>
      </Step>
    );
  } else if (c.status === "rejected" || c.status === "cancelled") {
    next = <Step tone="muted" text={`${CR_STATUS_LABELS[c.status]}${c.closed_reason ? ` — ${c.closed_reason}` : ""}.`} />;
  }

  return (
    <div className="flex flex-col gap-4 max-w-[980px] w-full mx-auto">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[260px]">
          <p className="text-[12px]">
            <Link href={`/projects/${projectId}/change-requests`} className="text-[#8A867E] hover:text-[#191817] font-semibold">
              Change request
            </Link>
            <span className="text-[#D6D2CB]"> / </span>
            <code className="font-bold text-[#6A62C4]">{c.cr_id}</code>
          </p>
          <h2 className="text-[20px] font-extrabold text-[#191817]">{c.title}</h2>
          <p className="text-[11.5px] text-[#8A867E]">
            {CR_SOURCE_LABELS[c.source.kind]}
            {c.source.ref ? ` · ${c.source.ref}` : ""} · yêu cầu bởi {c.requester} · tạo {formatDateTime(c.created_at)} · trên bản {c.base_doc_version}
          </p>
        </div>
        {!terminal && (
          <button type="button" onClick={() => setDialog("cancel")} disabled={busy} className="px-3 py-1.5 rounded-[8px] border border-[#F2CACA] bg-white text-[12px] font-bold text-[#B03030] disabled:opacity-50">
            Huỷ CR
          </button>
        )}
      </div>

      <CrTimeline status={c.status} />

      <p className="text-[13px] text-[#33312D] whitespace-pre-wrap bg-white border border-[#ECEAE5] rounded-[14px] p-3.5">{c.description}</p>

      {cr.error && (
        <div role="alert" className="flex items-center gap-3 bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-4 py-3 rounded-[12px] text-[12.5px]">
          <span className="flex-1">{cr.error}</span>
          <button type="button" onClick={cr.clearError} className="font-bold hover:opacity-75" aria-label="Đóng thông báo lỗi">
            ✕
          </button>
        </div>
      )}

      {next}

      {(c.clarifications.length > 0 || pending_questions.length > 0) && (
        <ClarifyPanel
          key={`${c.clarifications.length}:${pending_questions.join("|")}`}
          cr={c}
          pendingQuestions={c.status === "awaiting_answers" ? pending_questions : []}
          busy={cr.busy === "answers"}
          onAnswer={(answers) => after(cr.answer(answers))}
        />
      )}

      {c.status === "in_review" || c.status === "written" || c.status === "rejected" ? (
        <ChangeGroupPanel
          groups={groups}
          locations={locations}
          canDecide={c.status === "in_review"}
          busy={busy}
          onDecide={(gid, decision, reason) => after(cr.decide(gid, decision, reason))}
        />
      ) : (
        <ImpactList
          locations={locations}
          editable={(EDITABLE as readonly string[]).includes(c.status) && !c.paused}
          busy={cr.busy === "patch"}
          onPatch={(locId, body) => after(cr.patch(locId, body))}
        />
      )}

      <ReasonDialog
        key={dialog ?? "none"}
        open={dialog !== null}
        title={dialog === "close" ? "Đóng change request" : "Huỷ change request"}
        description={
          dialog === "close"
            ? "Mọi nhóm đã bị từ chối. Đóng CR sẽ mở khoá toàn bộ block, CR chuyển sang trạng thái từ chối."
            : "Huỷ sẽ mở khoá mọi block CR đang giữ. Không ghi gì vào tài liệu."
        }
        confirmLabel={dialog === "close" ? "Đóng CR" : "Huỷ CR"}
        busy={cr.busy === "close" || cr.busy === "cancel"}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => {
          const run = dialog === "close" ? cr.close(reason) : cr.cancel(reason);
          void run.then((ok) => {
            if (ok) {
              setDialog(null);
              onChanged?.();
            }
          });
        }}
      />
    </div>
  );
}

function Step({ text, tone = "info", children }: { text: string; tone?: "info" | "warn" | "ok" | "muted"; children?: ReactNode }) {
  const cls = {
    info: "bg-[#F2F1FB] border-[#DCD8F0] text-[#554DB0]",
    warn: "bg-[#FBF4E4] border-[#EFD9A6] text-[#8A6D1F]",
    ok: "bg-[#E9F7EE] border-[#BFE6CE] text-[#1F7A45]",
    muted: "bg-[#F0EEEA] border-[#E4E1DC] text-[#6B6862]",
  }[tone];
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-[12px] border px-4 py-3 text-[12.5px] ${cls}`} aria-label="Bước tiếp theo">
      <p className="flex-1 min-w-[220px]">{text}</p>
      {children}
    </div>
  );
}
