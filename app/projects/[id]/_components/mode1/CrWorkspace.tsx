"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CR_MAX_MATERIALS, CR_TERMINAL_STATUSES, type CrDetail, type CrLocation } from "@/types/change-request";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { useChangeRequest } from "../../hooks/mode1/useChangeRequest";
import ChangeGroupPanel from "./ChangeGroupPanel";
import ClarifyPanel from "./ClarifyPanel";
import { MaterialAdder, MaterialList } from "./CrMaterials";
import CrTimeline from "./CrTimeline";
import ImpactList from "./ImpactList";
import { useMode1Labels } from "./i18n";
import PausedBanner from "./PausedBanner";
import ReasonDialog from "./ReasonDialog";
import { crListHref } from "./prefill";

/** Vị trí AI cần (đề xuất lại): chưa kết luận, hoặc kiểm trượt mà không phải sửa tay — cùng luật `needsProposal` BE. */
export const needsProposal = (l: CrLocation): boolean => !l.manual && (l.conclusion === null || (l.verify !== null && !l.verify.code_ok));

/** Trạng thái BE cho phép sửa tay vị trí (`location.service`). */
const EDITABLE = ["impact_review", "proposing", "manual_fix", "ready_to_submit"] as const;

/** Bước AI có tên riêng trong banner tạm dừng; trạng thái khác ⇒ "Bước AI". */
const PAUSED_WHAT = ["clarifying", "proposing", "verifying"] as const;
const pausedKey = (status: CrDetail["change_request"]["status"]): (typeof PAUSED_WHAT)[number] | "other" =>
  (PAUSED_WHAT as readonly string[]).includes(status) ? (status as (typeof PAUSED_WHAT)[number]) : "other";

interface CrWorkspaceProps {
  projectId: string;
  crId: string;
  /** Sau bước có thể đổi credit / version (header). */
  onChanged?: () => void;
  /** Viewer: chỉ xem CR — ẩn mọi nút hành động (BE cũng chặn ghi với 403). */
  readOnly?: boolean;
}

/**
 * Workspace một change request (3.1–3.14): mọi nút hành động chọn theo `status` BE trả. Bước AI (làm rõ, đề
 * xuất, kiểm) chạy đồng bộ; hết credit / lỗi AI ⇒ CR `paused` + nút tiếp tục.
 */
export default function CrWorkspace({ projectId, crId, onChanged, readOnly = false }: CrWorkspaceProps) {
  const t = useTranslations("mode1.crWorkspace");
  const L = useMode1Labels();
  const cr = useChangeRequest(projectId, crId);
  const [dialog, setDialog] = useState<"cancel" | "close" | null>(null);

  if (cr.loading) return <PageSkeleton rows={2} label={t("loading")} />;
  if (!cr.detail) {
    return (
      <div role="alert" className="bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] rounded-[12px] px-4 py-3 text-body">
        {cr.error ?? t("notFound")}
      </div>
    );
  }

  const { change_request: c, locations, groups, pending_questions } = cr.detail;
  const busy = cr.busy !== null;
  const after = (p: Promise<boolean>) => void p.then((ok) => ok && onChanged?.());
  const terminal = CR_TERMINAL_STATUSES.includes(c.status);
  const allRejected = groups.length > 0 && groups.every((g) => g.decision === "rejected");
  // Phase 7: tài liệu bổ sung chỉ thêm / xoá được trước khi tìm vị trí (BE: draft, awaiting_answers)
  const materialsEditable = !readOnly && (c.status === "draft" || c.status === "awaiting_answers") && !c.paused;
  const materialAdder = (
    <MaterialAdder
      busy={cr.busy === "material"}
      full={c.materials.length >= CR_MAX_MATERIALS}
      onAddText={(name, text) => cr.addMaterialText(name, text)}
      onAddFile={(file) => cr.addMaterialFile(file)}
    />
  );

  const primary = (label: string, onClick: () => void, busyLabel = t("running")) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="px-4 py-2 rounded-[10px] btn-gradient-primary text-white text-body font-bold disabled:opacity-50 cursor-pointer"
    >
      {busy ? busyLabel : label}
    </button>
  );

  /** Việc tiếp theo theo trạng thái — không suy diễn gì ngoài dữ liệu BE trả. */
  let next: ReactNode = null;
  if (c.paused) {
    next = <PausedBanner paused={c.paused} what={t(`paused.${pausedKey(c.status)}`)} busy={cr.busy === "resume"} onResume={() => after(cr.action("resume"))} />;
  } else if (c.status === "draft" || c.status === "clarifying") {
    next = (
      <Step text={t("draftText")}>
        {primary(t("draftButton"), () => after(cr.action("clarify")), t("draftBusy"))}
      </Step>
    );
  } else if (c.status === "impact_review" && locations.length === 0) {
    next = (
      <Step text={t("impactText")}>
        {primary(t("impactButton"), () => after(cr.action("impact")), t("impactBusy"))}
      </Step>
    );
  } else if (c.status === "impact_review" || (c.status === "proposing" && locations.some(needsProposal))) {
    const redo = locations.some((l) => l.verify && !l.verify.code_ok);
    // AI đã chạy mà còn vị trí chưa kết luận (model bỏ sót) ⇒ nói rõ, cho chọn chạy lại hoặc sửa tay
    const missed = c.status === "proposing" && !redo ? locations.filter((l) => l.conclusion === null).length : 0;
    const text = redo
      ? t("proposeRedoText")
      : missed > 0 && missed < locations.length
        ? t("proposeMissedText", { count: missed })
        : t("proposeText");
    next = (
      <Step text={text}>
        {primary(redo ? t("proposeRedoButton") : t("proposeButton"), () => after(cr.action("propose")), t("proposeBusy"))}
      </Step>
    );
  } else if (c.status === "proposing" || c.status === "verifying") {
    next = (
      <Step text={t("verifyText")}>
        {primary(t("verifyButton"), () => after(cr.action("verify")), t("verifyBusy"))}
      </Step>
    );
  } else if (c.status === "manual_fix") {
    next = (
      <Step tone="warn" text={t("manualText")}>
        {primary(t("manualButton"), () => after(cr.action("verify")), t("verifyBusy"))}
      </Step>
    );
  } else if (c.status === "ready_to_submit") {
    next = (
      <Step text={t("readyText")}>
        {primary(t("readyButton"), () => after(cr.action("submit")), t("readyBusy"))}
      </Step>
    );
  } else if (c.status === "in_review") {
    // 0 nhóm ⇒ không có gì để duyệt (mọi vị trí "không liên quan", hoặc CR nộp trước khi BE chặn việc này).
    // Không chỉ lối ra thì màn duyệt trống trơn, không một cái nút — CR kẹt vĩnh viễn ở in_review.
    next =
      allRejected || groups.length === 0 ? (
        <Step
          tone="warn"
          text={groups.length === 0 ? t("noGroupsText") : t("allRejectedText")}
        >
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => setDialog("close")} className="px-4 py-2 rounded-[10px] border border-[#F2CACA] bg-white text-body font-bold text-[#B03030] disabled:opacity-50">
              {t("closeCr")}
            </button>
            {primary(t("reviseButton"), () => after(cr.action("revise")), t("reviseBusy"))}
          </div>
        </Step>
      ) : (
        <Step text={t("reviewText")} />
      );
  } else if (c.status === "written") {
    next = (
      <Step
        tone="ok"
        text={c.result_doc_version ? t("writtenText", { version: c.result_doc_version, crId: c.cr_id }) : t("writtenNewText", { crId: c.cr_id })}
      >
        <Link href={`/projects/${projectId}`} className="px-4 py-2 rounded-[10px] bg-[#1F7A45] text-white text-body font-bold">
          {t("viewDoc")}
        </Link>
      </Step>
    );
  } else if (c.status === "rejected" || c.status === "cancelled") {
    next = <Step tone="muted" text={c.closed_reason ? t("closedReasonText", { status: L.crStatus(c.status), reason: c.closed_reason }) : t("closedText", { status: L.crStatus(c.status) })} />;
  }

  // Viewer: thay bước tiếp theo (toàn nút hành động) bằng lời nhắc; CR đã kết thúc thì vẫn hiện kết quả như thường
  if (readOnly && !terminal) {
    next = <Step tone="muted" text={t("viewerText")} />;
  }

  return (
    <div className="flex flex-col gap-4 max-w-[980px] w-full mx-auto">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[260px]">
          <p className="text-body">
            <Link href={crListHref(projectId)} scroll={false} className="text-[#8A867E] hover:text-[#191817] font-semibold">
              {t("breadcrumb")}
            </Link>
            <span className="text-[#D6D2CB]"> / </span>
            <code className="font-bold text-[#6A62C4]">{c.cr_id}</code>
          </p>
          <h2 className="text-title font-extrabold text-[#191817]">{c.title}</h2>
          <p className="text-body text-[#8A867E]">
            {L.crSource(c.source.kind)}
            {L.sourceRefLabel(c.source.ref) ? ` · ${L.sourceRefLabel(c.source.ref)}` : ""}
            {t("meta", { requester: c.requester, created: L.formatDateTime(c.created_at), version: c.base_doc_version })}
          </p>
        </div>
        {!terminal && !readOnly && (
          <button type="button" onClick={() => setDialog("cancel")} disabled={busy} className="px-3 py-1.5 rounded-[8px] border border-[#F2CACA] bg-white text-body font-bold text-[#B03030] disabled:opacity-50">
            {t("cancelCr")}
          </button>
        )}
      </div>

      <CrTimeline status={c.status} />

      <p className="text-body text-[#33312D] whitespace-pre-wrap bg-white border border-[#ECEAE5] rounded-[14px] p-3.5">{c.description}</p>

      {c.seed && (
        <p className="text-body text-[#554DB0] bg-[#F2F1FB] border border-[#DCD8F0] rounded-[12px] px-3.5 py-2.5" aria-label={t("seedAria")}>
          {c.seed.targets.length ? t("seedTargets", { count: c.seed.ops.length, targets: c.seed.targets.length }) : t("seed", { count: c.seed.ops.length })}
        </p>
      )}

      {(c.materials.length > 0 || (materialsEditable && c.status === "draft")) && (
        <section className="flex flex-col gap-2 bg-[#FAF9F7] border border-[#ECEAE5] rounded-[14px] p-3.5" aria-label={t("materialsAria")}>
          <h3 className="font-bold text-[#191817] text-body">{t("materialsTitle", { count: c.materials.length })}</h3>
          {c.status === "draft" && (
            <p className="text-body text-[#6B6862]">{t("materialsHint")}</p>
          )}
          <MaterialList
            items={c.materials.map((m) => ({ key: m.material_id, name: m.name, kind: m.kind, text: m.text, truncated: m.truncated, round: m.round }))}
            onRemove={materialsEditable ? (id) => void cr.removeMaterial(id) : undefined}
            busy={cr.busy === "material"}
          />
          {materialsEditable && c.status === "draft" && materialAdder}
        </section>
      )}

      {cr.error && (
        <div role="alert" className="flex items-center gap-3 bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-4 py-3 rounded-[12px] text-body">
          <span className="flex-1">{cr.error}</span>
          <button type="button" onClick={cr.clearError} className="font-bold hover:opacity-75" aria-label={t("errorClose")}>
            ✕
          </button>
        </div>
      )}

      {next}

      {(c.clarifications.length > 0 || pending_questions.length > 0) && (
        <ClarifyPanel
          key={`${c.clarifications.length}:${pending_questions.join("|")}`}
          cr={c}
          pendingQuestions={c.status === "awaiting_answers" && !readOnly ? pending_questions : []}
          busy={cr.busy === "answers"}
          onAnswer={(answers) => after(cr.answer(answers))}
          materials={c.status === "awaiting_answers" && materialsEditable ? materialAdder : undefined}
        />
      )}

      {c.missing_info.length > 0 && !terminal && (
        <div className="bg-[#FBF4E4] border border-[#EFD9A6] rounded-[12px] px-3.5 py-2.5 text-body text-[#8A6D1F]" aria-label={t("missingInfoAria")}>
          <p className="font-bold">{t("missingInfoTitle")}</p>
          <ul className="list-disc pl-5">
            {c.missing_info.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {c.status === "in_review" || c.status === "written" || c.status === "rejected" ? (
        <ChangeGroupPanel
          groups={groups}
          locations={locations}
          canDecide={c.status === "in_review" && !readOnly}
          busy={busy}
          onDecide={(gid, decision, reason) => after(cr.decide(gid, decision, reason))}
        />
      ) : (
        <ImpactList
          locations={locations}
          editable={!readOnly && (EDITABLE as readonly string[]).includes(c.status) && !c.paused}
          busy={cr.busy === "patch"}
          onPatch={(locId, body) => after(cr.patch(locId, body))}
          onOwnerDraft={!readOnly && c.status === "manual_fix" && !c.paused ? (locId, instruction) => after(cr.ownerDraft(locId, instruction)) : undefined}
        />
      )}

      <ReasonDialog
        key={dialog ?? "none"}
        open={dialog !== null}
        title={dialog === "close" ? t("closeTitle") : t("cancelTitle")}
        description={dialog === "close" ? t("closeDescription") : t("cancelDescription")}
        confirmLabel={dialog === "close" ? t("closeCr") : t("cancelCr")}
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
  const t = useTranslations("mode1.crWorkspace");
  const cls = {
    info: "bg-[#F2F1FB] border-[#DCD8F0] text-[#554DB0]",
    warn: "bg-[#FBF4E4] border-[#EFD9A6] text-[#8A6D1F]",
    ok: "bg-[#E9F7EE] border-[#BFE6CE] text-[#1F7A45]",
    muted: "bg-[#F0EEEA] border-[#E4E1DC] text-[#6B6862]",
  }[tone];
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-[12px] border px-4 py-3 text-body ${cls}`} aria-label={t("stepAria")}>
      <p className="flex-1 min-w-[220px]">{text}</p>
      {children}
    </div>
  );
}
