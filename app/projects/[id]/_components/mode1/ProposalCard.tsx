"use client";

import { useState } from "react";
import type { CrLocation, LocationConclusion, PatchLocationRequest } from "@/types/change-request";
import FieldChanges from "./FieldChanges";
import { CONCLUSION_LABELS, FOUND_BY_LABELS } from "./labels";
import { valueSummary } from "./value-diff";
import VerifyResult from "./VerifyResult";

interface ProposalCardProps {
  location: CrLocation;
  /** Cho sửa tay / kết luận tay (3.9) — theo trạng thái CR BE cho phép. */
  editable: boolean;
  onPatch: (body: PatchLocationRequest) => void;
  busy?: boolean;
}

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
    <div className="flex flex-col gap-2 bg-[#FAF9F7] border border-[#ECEAE5] rounded-[10px] p-3" aria-label={`Sửa tay ${location.location_id}`}>
      <div className="flex flex-wrap gap-3 text-[12px] font-semibold text-[#4B4842]" role="radiogroup" aria-label="Kết luận">
        {(Object.keys(CONCLUSION_LABELS) as LocationConclusion[]).map((c) => (
          <label key={c} className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name={`conclusion-${location.location_id}`} checked={conclusion === c} onChange={() => setConclusion(c)} />
            {CONCLUSION_LABELS[c]}
          </label>
        ))}
      </div>
      {conclusion === "edit" && (
        <>
          <textarea
            aria-label="Giá trị mới (JSON)"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full px-2.5 py-1.5 rounded-[8px] border border-[#E4E1DC] bg-white text-[12px] font-mono"
          />
          {jsonError && <p className="text-[11.5px] text-[#B03030]">JSON chưa hợp lệ.</p>}
          {!jsonError && <FieldChanges oldText={current} newText={newValue} />}
        </>
      )}
      {conclusion === "comment" && (
        <textarea aria-label="Nội dung comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="w-full px-2.5 py-1.5 rounded-[8px] border border-[#E4E1DC] bg-white text-[12.5px]" />
      )}
      <input
        aria-label="Lý do"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={conclusion === "not_related" ? "Lý do không liên quan (bắt buộc)" : "Lý do (tuỳ chọn)"}
        className="w-full px-2.5 py-1.5 rounded-[8px] border border-[#E4E1DC] bg-white text-[12.5px]"
      />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-3 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-[12px] font-semibold">
          Huỷ
        </button>
        <button type="button" onClick={submit} disabled={invalid || busy} className="px-3 py-1 rounded-[8px] bg-[#191817] text-white text-[12px] font-bold disabled:opacity-50">
          {busy ? "Đang lưu…" : "Lưu sửa tay"}
        </button>
      </div>
    </div>
  );
}

/**
 * Một vị trí ảnh hưởng (C-3) và đề xuất cho nó (C-4, UC-81) — mode 1 v2: phần tử Spine (path + section), nguồn tìm
 * thấy, kết luận + lý do, thay đổi theo field, comment, kết quả kiểm; sửa tay khi AI trượt (3.9).
 */
export default function ProposalCard({ location, editable, onPatch, busy = false }: ProposalCardProps) {
  const [editing, setEditing] = useState(false);
  const p = location.proposal;
  const failed = location.verify && !location.verify.code_ok;
  const summary = valueSummary(p?.old_text ?? location.current_text);

  return (
    <article
      className={`bg-white border rounded-[14px] p-3.5 flex flex-col gap-2 ${failed ? "border-[#F2CACA]" : "border-[#ECEAE5]"}`}
      aria-label={`Vị trí ${location.location_id}`}
    >
      <header className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
        <code className="font-bold text-[#191817]">{location.path}</code>
        {location.found_by.map((f) => (
          <span key={f} className="px-1.5 py-0.5 rounded bg-[#F0EEEA] text-[#4B4842] font-semibold">
            {FOUND_BY_LABELS[f]}
          </span>
        ))}
        {/* Vị trí "mục trống" (phương án B): path là cả mảng — CR thêm phần tử mới chứ không sửa cái đang có */}
        {location.path.endsWith("[]") && <span className="px-1.5 py-0.5 rounded bg-[#F2F1FB] text-[#6A62C4] font-bold">mục trống — thêm mới</span>}
        {location.owner_step && <span className="text-[#A8A49C]">· bước {location.owner_step}</span>}
        {location.manual && <span className="px-1.5 py-0.5 rounded bg-[#FBF4E4] text-[#8A6D1F] font-bold">sửa tay</span>}
        {location.conclusion && (
          <span className={`ml-auto px-2 py-0.5 rounded-full font-bold ${CONCLUSION_TONE[location.conclusion]}`}>{CONCLUSION_LABELS[location.conclusion]}</span>
        )}
      </header>

      {location.section_title && <p className="text-[11px] text-[#A8A49C]">Mục: {location.section_title}</p>}
      {summary && <p className="text-[12.5px] text-[#33312D] whitespace-pre-wrap">{summary}</p>}
      {location.entity_paths.length > 0 && <p className="text-[11px] text-[#8A867E] font-mono">liên quan: {location.entity_paths.join(", ")}</p>}

      {location.conclusion === "edit" && p && <FieldChanges oldText={p.old_text} newText={p.new_text} />}
      {location.conclusion === "comment" && p?.comment_text && (
        <p className="text-[12px] text-[#3B4FA8] bg-[#EEF1FB] rounded-[8px] px-2.5 py-1.5">💬 {p.comment_text}</p>
      )}
      {location.reason && <p className="text-[12px] text-[#6B6862]">Lý do: {location.reason}</p>}

      <VerifyResult location={location} />

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
          <div className="flex justify-end">
            <button type="button" onClick={() => setEditing(true)} className="px-3 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-[12px] font-bold text-[#191817] hover:bg-[#FAF9F7]">
              Sửa tay
            </button>
          </div>
        ))}
    </article>
  );
}
