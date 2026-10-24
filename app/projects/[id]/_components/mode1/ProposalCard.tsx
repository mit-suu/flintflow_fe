"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CrLocation, LocationFoundBy, LocationConclusion, PatchLocationRequest } from "@/types/change-request";
import { AssumptionsNote } from "./CrMaterials";
import FieldChanges from "./FieldChanges";
import OriginalDiagramChange, { diagramLocationTitle, isDiagramLocation } from "./OriginalDiagramChange";
import { CONCLUSION_KINDS, formatPercent } from "./labels";
import { useMode1Labels } from "./i18n";
import VerifyResult from "./VerifyResult";
import { tStep } from "@/lib/i18n";

interface ProposalCardProps {
  location: CrLocation;
  /** Cho sửa tay / kết luận tay (3.9) — theo trạng thái CR BE cho phép. */
  editable: boolean;
  onPatch: (body: PatchLocationRequest) => void;
  /** BPMN 3.9 (mode 1 v3): sửa đề xuất bằng skill của step sở hữu, theo hướng của BA — chỉ có ở CR `manual_fix`. */
  onOwnerDraft?: (instruction: string) => void;
  busy?: boolean;
}

/**
 * Nguồn chỉ nói "có nội dung gần giống", khác với nguồn tất định (`spine_link` liên kết field, `mention`
 * nhắc mã, `preview` từ bản xem trước, `diagram` từ hình gốc).
 */
const RECALL_ONLY_SOURCES: readonly LocationFoundBy[] = ["vector", "keyword"];

/**
 * Vị trí chỉ đến từ truy hồi: không có nguồn tất định nào. BE có một hàm cùng tên ý
 * (`change-request/spine-location.ts`) nhưng nó chỉ dùng nội bộ để cắt trần 80 vị trí, không phải nghĩa
 * người dùng thấy — nên đừng coi hai bên là một.
 */
const isRecallOnlyLocation = (loc: Pick<CrLocation, "found_by">): boolean =>
  loc.found_by.every((b) => RECALL_ONLY_SOURCES.includes(b));

/**
 * Vị trí mà "gần nghĩa" là lý do DUY NHẤT nó có trong danh sách: có `vector` và không có nguồn tất định
 * nào. Người duyệt nên đọc kỹ hơn những vị trí này.
 *
 * Hẹp hơn `isRecallOnlyLocation`: vị trí chỉ có `keyword` cũng là recall-only, nhưng nó trùng TỪ chứ
 * không gần NGHĨA — gộp hai thứ lại thì nhãn nói sai về cách máy tìm ra nó.
 */
export const isVectorOnlyLocation = (loc: Pick<CrLocation, "found_by">): boolean =>
  loc.found_by.includes("vector") && isRecallOnlyLocation(loc);

const CONCLUSION_TONE: Record<LocationConclusion, string> = {
  edit: "bg-[#F2F1FB] text-[#554DB0]",
  comment: "bg-[#EEF1FB] text-[#3B4FA8]",
  not_related: "bg-[#F0EEEA] text-[#6B6862]",
};

const parseJson = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

/**
 * Form sửa tay một vị trí: kết luận + nội dung tương ứng. Sửa (`edit`) = giá trị mới của cả phần tử Spine dạng JSON
 * (FLF-186 — BE đổi thành op `set` tại path; không được đổi `id`). `not_related` bắt buộc lý do (như BE).
 */
function ManualEditForm({ location, onPatch, onClose, busy }: { location: CrLocation; onPatch: ProposalCardProps["onPatch"]; onClose: () => void; busy: boolean }) {
  const t = useTranslations("mode1.proposalCard");
  const L = useMode1Labels();
  const current = location.proposal?.old_text ?? location.current_text;
  const [conclusion, setConclusion] = useState<LocationConclusion>(location.conclusion ?? "edit");
  const [newValue, setNewValue] = useState(location.proposal?.new_text ?? current);
  const [comment, setComment] = useState(location.proposal?.comment_text ?? "");
  const [reason, setReason] = useState(location.reason ?? "");

  const parsed = parseJson(newValue);
  const jsonError = conclusion === "edit" && !parsed.ok;
  const invalid =
    (conclusion === "edit" && (jsonError || newValue.trim() === current.trim())) ||
    (conclusion === "comment" && !comment.trim()) ||
    (conclusion === "not_related" && !reason.trim());

  const submit = () =>
    onPatch({
      conclusion,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
      ...(conclusion === "edit" && parsed.ok ? { new_value: parsed.value } : {}),
      ...(conclusion === "comment" ? { comment_text: comment.trim() } : {}),
    });

  return (
    <div className="flex flex-col gap-2 bg-[#FAF9F7] border border-[#ECEAE5] rounded-[10px] p-3" aria-label={t("manualAria", { id: location.location_id })}>
      <div className="flex flex-wrap gap-3 text-body font-semibold text-[#4B4842]" role="radiogroup" aria-label={t("conclusionAria")}>
        {CONCLUSION_KINDS.map((c) => (
          <label key={c} className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name={`conclusion-${location.location_id}`} checked={conclusion === c} onChange={() => setConclusion(c)} />
            {L.conclusion(c)}
          </label>
        ))}
      </div>
      {conclusion === "edit" && (
        <>
          <textarea
            aria-label={t("newValueAria")}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full px-2.5 py-1.5 rounded-[8px] border border-[#E4E1DC] bg-white text-body font-mono"
          />
          {jsonError && <p className="text-body text-[#B03030]">{t("jsonInvalid")}</p>}
          {!jsonError && <FieldChanges oldText={current} newText={newValue} />}
        </>
      )}
      {conclusion === "comment" && (
        <textarea aria-label={t("commentAria")} value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="w-full px-2.5 py-1.5 rounded-[8px] border border-[#E4E1DC] bg-white text-body" />
      )}
      <input
        aria-label={t("reasonAria")}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={conclusion === "not_related" ? t("reasonRequired") : t("reasonOptional")}
        className="w-full px-2.5 py-1.5 rounded-[8px] border border-[#E4E1DC] bg-white text-body"
      />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-3 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-body font-semibold">
          {t("cancel")}
        </button>
        <button type="button" onClick={submit} disabled={invalid || busy} className="px-3 py-1 rounded-[8px] bg-[#191817] text-white text-body font-bold disabled:opacity-50">
          {busy ? t("saving") : t("saveManual")}
        </button>
      </div>
    </div>
  );
}

/**
 * Một vị trí ảnh hưởng (C-3) và đề xuất cho nó (C-4, UC-81) — mode 1 v2: phần tử Spine (path + section), nguồn tìm
 * thấy, kết luận + lý do, thay đổi theo field, comment, kết quả kiểm; sửa tay khi AI trượt (3.9).
 */
/** 3.9: BA ghi hướng sửa, AI viết lại đề xuất theo skill của step sở hữu (tốn credit); kiểm lại sau đó. */
function OwnerStepDraftForm({ step, busy, onSubmit, onClose }: { step: string; busy: boolean; onSubmit: (instruction: string) => void; onClose: () => void }) {
  const t = useTranslations("mode1.proposalCard");
  const locale = useLocale();
  const label = tStep(step, locale);
  const [instruction, setInstruction] = useState("");
  return (
    <div className="flex flex-col gap-2 bg-[#F2F1FB] border border-[#DCD8F0] rounded-[10px] p-3" aria-label={t("ownerAria", { step: label })}>
      <label className="text-body font-semibold text-[#4B4842]" htmlFor={`owner-draft-${step}`}>
        {t("ownerLabel", { step: label })}
      </label>
      <textarea
        id={`owner-draft-${step}`}
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        rows={3}
        placeholder={t("ownerPlaceholder")}
        className="w-full px-2.5 py-1.5 rounded-[8px] border border-[#DCD8F0] bg-white text-body"
      />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-3 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-body font-semibold">
          {t("cancel")}
        </button>
        <button
          type="button"
          onClick={() => onSubmit(instruction.trim())}
          disabled={!instruction.trim() || busy}
          className="px-3 py-1 rounded-[8px] bg-[#6A62C4] text-white text-body font-bold disabled:opacity-50"
        >
          {busy ? t("rewriting") : t("rewrite")}
        </button>
      </div>
    </div>
  );
}

export default function ProposalCard({ location, editable, onPatch, onOwnerDraft, busy = false }: ProposalCardProps) {
  const t = useTranslations("mode1.proposalCard");
  const tDiagram = useTranslations("mode1.originalDiagram");
  const locale = useLocale();
  const { valueSummary, sectionTitle, pathLabel, humanizeText, foundBy, conclusion } = useMode1Labels();
  const [editing, setEditing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const p = location.proposal;
  const failed = location.verify && !location.verify.code_ok;
  const summary = valueSummary(p?.old_text ?? location.current_text);

  return (
    <article
      className={`bg-white border rounded-[14px] p-3.5 flex flex-col gap-2 ${failed ? "border-[#F2CACA]" : "border-[#ECEAE5]"}`}
      aria-label={t("aria", { id: location.location_id })}
    >
      <header className="flex flex-wrap items-center gap-1.5 text-body">
        {/* F6: vị trí hiện theo mục của tài liệu; path Spine chỉ để tra (tooltip) */}
        <span className="font-bold text-[#191817]" title={location.path}>
          {isDiagramLocation(location) ? diagramLocationTitle(location, tDiagram) : sectionTitle(location.section_id, location.section_title) || pathLabel(location.path)}
        </span>
        {location.found_by.map((f) => {
          // Chip "Theo nghĩa" mang luôn độ khớp. `vector_score` tuỳ chọn ⇒ chỉ format khi thật là số:
          // `?? 0` sẽ in "0%", một con số sai, khác hẳn với "không có số".
          const vector = f === "vector";
          const score = vector && typeof location.vector_score === "number" ? ` · ${formatPercent(location.vector_score)}` : "";
          // Vị trí chỉ tìm được nhờ nghĩa: tô khác để mắt bắt được trong hàng chip xám. Hàng này đã dùng
          // xám / tím / vàng, nên xanh info là màu duy nhất còn trống ở đây.
          const vectorOnly = vector && isVectorOnlyLocation(location);
          return (
            <span
              key={f}
              title={vector ? t("vectorTitle") : undefined}
              className={`px-1.5 py-0.5 rounded font-semibold ${vectorOnly ? "bg-info-soft text-info" : "bg-[#F0EEEA] text-[#4B4842]"}`}
            >
              {foundBy(f)}
              {score}
            </span>
          );
        })}
        {/* Vị trí "mục trống" (phương án B): path là cả mảng — CR thêm phần tử mới chứ không sửa cái đang có */}
        {location.path.endsWith("[]") && <span className="px-1.5 py-0.5 rounded bg-[#F2F1FB] text-[#6A62C4] font-bold">{t("emptySlot")}</span>}
        {location.owner_step && <span className="text-[#A8A49C]" title={location.owner_step}>{t("ownerStep", { step: tStep(location.owner_step, locale) })}</span>}
        {location.manual && <span className="px-1.5 py-0.5 rounded bg-[#FBF4E4] text-[#8A6D1F] font-bold">{t("manualBadge")}</span>}
        {location.conclusion && (
          <span className={`ml-auto px-2 py-0.5 rounded-full font-bold ${CONCLUSION_TONE[location.conclusion]}`}>{conclusion(location.conclusion)}</span>
        )}
      </header>

      {summary && !isDiagramLocation(location) && <p className="text-body text-[#33312D] whitespace-pre-wrap">{summary}</p>}
      {location.entity_paths.length > 0 && <p className="text-caption text-[#8A867E]" title={location.entity_paths.join(", ")}>{t("related", { paths: location.entity_paths.map((p) => pathLabel(p)).join(", ") })}</p>}

      {location.conclusion === "edit" && p && (isDiagramLocation(location) ? <OriginalDiagramChange loc={location} /> : <FieldChanges oldText={p.old_text} newText={p.new_text} />)}
      {location.conclusion === "comment" && p?.comment_text && (
        <p className="text-body text-[#3B4FA8] bg-[#EEF1FB] rounded-[8px] px-2.5 py-1.5">💬 {p.comment_text}</p>
      )}
      {location.reason && <p className="text-body text-[#6B6862]">{t("reason", { reason: humanizeText(location.reason) })}</p>}
      {location.conclusion !== "not_related" && <AssumptionsNote assumptions={p?.assumptions} />}

      <VerifyResult location={location} />

      {onOwnerDraft && location.owner_step && drafting && (
        <OwnerStepDraftForm
          step={location.owner_step}
          busy={busy}
          onClose={() => setDrafting(false)}
          onSubmit={(instruction) => {
            onOwnerDraft(instruction);
            setDrafting(false);
          }}
        />
      )}

      {editable &&
        (editing ? (
          <ManualEditForm
            location={location}
            busy={busy}
            onClose={() => setEditing(false)}
            onPatch={(body) => {
              onPatch(body);
              setEditing(false);
            }}
          />
        ) : (
          <div className="flex justify-end gap-2">
            {onOwnerDraft && location.owner_step && !drafting && (
              <button
                type="button"
                onClick={() => setDrafting(true)}
                className="px-3 py-1 rounded-[8px] bg-[#6A62C4] text-white text-body font-bold"
              >
                {t("askAi")}
              </button>
            )}
            <button type="button" onClick={() => setEditing(true)} className="px-3 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-body font-bold text-[#191817] hover:bg-[#FAF9F7]">
              {onOwnerDraft && location.owner_step ? t("editDirect") : t("editManual")}
            </button>
          </div>
        ))}
    </article>
  );
}
