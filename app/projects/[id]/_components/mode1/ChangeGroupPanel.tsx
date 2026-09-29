"use client";

import { useState } from "react";
import { DECISION_REASON_MIN_LENGTH, type CrGroup, type CrLocation } from "@/types/change-request";
import { AssumptionsNote } from "./CrMaterials";
import FieldChanges from "./FieldChanges";
import { humanizeText, pathLabel, sectionTitle } from "./spine-labels";
import { CONCLUSION_LABELS, formatDateTime } from "./labels";

interface ChangeGroupPanelProps {
  groups: CrGroup[];
  locations: CrLocation[];
  /** Chỉ quyết được khi CR `in_review`. */
  canDecide: boolean;
  /** BPMN 3.12 (mode 1 v3): quyết định nào cũng kèm lý do. */
  onDecide: (groupId: string, decision: "approved" | "rejected", reason: string) => void;
  busy?: boolean;
}

const DECISION_TONE = {
  pending: "bg-[#FBF4E4] text-[#8A6D1F]",
  approved: "bg-[#E9F7EE] text-[#1F7A45]",
  rejected: "bg-[#FDEDED] text-[#B03030]",
} as const;

const DECISION_LABEL = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" } as const;

function GroupCard({ group, locations, canDecide, onDecide, busy }: { group: CrGroup; locations: CrLocation[] } & Omit<ChangeGroupPanelProps, "groups" | "locations">) {
  const [deciding, setDeciding] = useState<"approved" | "rejected" | null>(null);
  const [reason, setReason] = useState("");
  const tooShort = reason.trim().length < DECISION_REASON_MIN_LENGTH;
  const assumed = locations.reduce((n, l) => n + (l.conclusion === "not_related" ? 0 : (l.proposal?.assumptions?.length ?? 0)), 0);

  return (
    <article className="bg-white border border-[#ECEAE5] rounded-[14px] p-3.5 flex flex-col gap-2" aria-label={`Nhóm ${group.group_id}`}>
      <header className="flex items-center gap-2">
        <h4 className="flex-1 font-bold text-[#191817] text-[13px] truncate" title={group.group_id}>
          {humanizeText(group.title)}
        </h4>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${DECISION_TONE[group.decision]}`}>{DECISION_LABEL[group.decision]}</span>
      </header>
      {locations.map((l) => (
        <div key={l.location_id} className="text-[12px] border-l-2 border-[#ECEAE5] pl-2.5">
          {/* F6: hiển thị theo mục của tài liệu; path Spine chỉ để tra (tooltip) */}
          <p className="text-[11px] text-[#8A867E]" title={l.path}>
            {sectionTitle(l.section_id, l.section_title) || pathLabel(l.path)} · {l.conclusion ? CONCLUSION_LABELS[l.conclusion] : "—"}
          </p>
          {l.conclusion === "edit" && l.proposal ? (
            <FieldChanges oldText={l.proposal.old_text} newText={l.proposal.new_text} />
          ) : l.proposal?.comment_text ? (
            <p className="text-[#3B4FA8]">💬 {l.proposal.comment_text}</p>
          ) : null}
          {l.conclusion !== "not_related" && <AssumptionsNote assumptions={l.proposal?.assumptions} />}
        </div>
      ))}
      {canDecide && group.decision === "pending" && assumed > 0 && (
        <p className="text-[11.5px] font-semibold text-[#8A6D1F]">
          Nhóm này có {assumed} giả định AI tự đặt — xác nhận với người yêu cầu trước khi duyệt, hoặc ghi rõ trong lý do.
        </p>
      )}
      {group.decision !== "pending" && (
        <p className="text-[11.5px] text-[#6B6862]">
          {group.reason ? `Lý do: ${group.reason} · ` : ""}
          {formatDateTime(group.decided_at)}
        </p>
      )}
      {canDecide && group.decision === "pending" && (
        <div className="flex flex-col gap-2">
          {deciding && (
            <textarea
              aria-label={`Lý do ${deciding === "approved" ? "duyệt" : "từ chối"} ${group.group_id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder={`Lý do ${deciding === "approved" ? "duyệt" : "từ chối"} (ít nhất ${DECISION_REASON_MIN_LENGTH} ký tự)`}
              className={`w-full px-2.5 py-1.5 rounded-[8px] border bg-white text-[12.5px] ${deciding === "approved" ? "border-[#BFE6CE]" : "border-[#F2CACA]"}`}
            />
          )}
          <div className="flex gap-2 justify-end">
            {deciding ? (
              <>
                <button type="button" onClick={() => setDeciding(null)} className="px-3 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-[12px] font-semibold">
                  Huỷ
                </button>
                <button
                  type="button"
                  disabled={tooShort || busy}
                  onClick={() => onDecide(group.group_id, deciding, reason.trim())}
                  className={`px-3 py-1 rounded-[8px] text-white text-[12px] font-bold disabled:opacity-50 ${deciding === "approved" ? "bg-[#1F7A45]" : "bg-[#B03030]"}`}
                >
                  {deciding === "approved" ? "Xác nhận duyệt" : "Xác nhận từ chối"}
                </button>
              </>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={() => setDeciding("rejected")} className="px-3 py-1 rounded-[8px] border border-[#F2CACA] bg-white text-[12px] font-bold text-[#B03030] disabled:opacity-50">
                  Từ chối
                </button>
                <button type="button" disabled={busy} onClick={() => setDeciding("approved")} className="px-3 py-1 rounded-[8px] bg-[#1F7A45] text-white text-[12px] font-bold disabled:opacity-50">
                  Duyệt
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

/**
 * 3.11–3.12 Duyệt từng change group (UC-51, UC-52): duyệt / từ chối, **cả hai đều kèm lý do** (BPMN 3.12, mode 1 v3). Group bị từ chối mở khoá phần tử
 * ngay; group cuối được quyết mà có group duyệt ⇒ BE ghi op vào Spine và render version minor mới (FLF-186).
 */
export default function ChangeGroupPanel({ groups, locations, canDecide, onDecide, busy = false }: ChangeGroupPanelProps) {
  if (groups.length === 0) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="font-extrabold text-[#191817] text-[14px]">Nhóm thay đổi ({groups.length})</h3>
      {groups.map((g) => (
        <GroupCard
          key={g.group_id}
          group={g}
          locations={locations.filter((l) => g.location_ids.includes(l.location_id))}
          canDecide={canDecide}
          onDecide={onDecide}
          busy={busy}
        />
      ))}
    </section>
  );
}
