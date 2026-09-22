"use client";

import { useState } from "react";
import { REGENERATE_LIMIT, stepLabel } from "@/lib/constants/step-registry";
import type { AssumptionBrief, ChangeSummary, GateAction, GateReadyEvent } from "@/types/pipeline";

/** Quyết định của user về một giả định AI vừa đặt ra (WP-5 · BUG-13). */
export type AssumptionDecision =
  | { kind: "confirm"; id: string }
  | { kind: "reject"; id: string }
  | { kind: "edit"; id: string; statement: string };

export interface BlockingFlag {
  id: string;
  message: string;
  remediation_step?: string;
}

interface GateCardProps {
  stepId: string;
  /** Hành động BE cho phép (sự kiện `gate_ready`). */
  actions: GateAction[];
  regenerateUsed: number;
  regenerateLimit?: number;
  busy?: boolean;
  /** Fast path: một GateCard gộp cuối phase. */
  phaseLabel?: string;
  /** Toàn bộ payload `gate_ready` — Lớp 4 "Bạn vừa có" (tóm tắt, cờ, giả định, thời gian, credit). */
  payload?: GateReadyEvent | null;
  /** Cờ đỏ đang chặn ký baseline (422 BASELINE_BLOCKED khi Accept ở S-9.5). */
  blockingFlags?: BlockingFlag[];
  onAssumptionDecision?: (decision: AssumptionDecision) => void;
  onGoToStep?: (stepId: string) => void;
  onAction: (action: GateAction, note?: string) => void;
}

const KIND_PREFIX: Record<ChangeSummary["kind"], string> = { add: "+", update: "~", remove: "−" };

const COLLECTION_VI: Record<string, string> = {
  project: "thông tin dự án",
  features: "nhóm chức năng",
  actors: "actor",
  roles: "vai trò",
  use_cases: "use case",
  screens: "màn hình",
  permissions: "quyền",
  entities: "thực thể",
  functions: "chức năng",
  validations: "ràng buộc",
  nfrs: "yêu cầu phi chức năng",
  business_rules: "quy tắc nghiệp vụ",
  common_requirements: "yêu cầu chung",
  messages: "thông điệp",
  other_requirements: "yêu cầu khác",
  glossary: "thuật ngữ",
  addendum: "ghi chú Brief",
  assumptions: "giả định",
  diagrams: "sơ đồ",
};

/** Gom tóm tắt theo (loại thay đổi × collection) để hiện "+3 use case: A, B, C". */
export const groupSummary = (summary: readonly ChangeSummary[]): { key: string; label: string; items: ChangeSummary[] }[] => {
  const groups = new Map<string, ChangeSummary[]>();
  for (const row of summary) {
    const key = `${row.kind}|${row.collection}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, items]) => {
    const [kind, collection] = key.split("|") as [ChangeSummary["kind"], string];
    return { key, label: `${KIND_PREFIX[kind]}${items.length} ${COLLECTION_VI[collection] ?? collection}`, items };
  });
};

const deltaText = (before: number, after: number): string => {
  const delta = after - before;
  if (delta === 0) return `${after}`;
  return `${before} → ${after} (${delta > 0 ? "+" : "−"}${Math.abs(delta)})`;
};

/**
 * Cổng chốt (Phases §3): Accept · Request revision (ghi chú) · Regenerate (n/3, tắt khi hết) ·
 * Accept as-is (chỉ khi hết Regenerate hoặc BE mở, bắt buộc lý do).
 */
export default function GateCard({
  stepId,
  actions,
  regenerateUsed,
  regenerateLimit = REGENERATE_LIMIT,
  busy = false,
  phaseLabel,
  payload = null,
  blockingFlags,
  onAssumptionDecision,
  onGoToStep,
  onAction,
}: GateCardProps) {
  const [mode, setMode] = useState<"revision" | "accept_as_is" | null>(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [decided, setDecided] = useState<Record<string, "confirm" | "reject" | "edit">>({});

  const summary = payload?.summary ?? [];
  const groups = groupSummary(summary);
  const assumptions: AssumptionBrief[] = (payload?.new_assumptions ?? []).filter((a) => !decided[a.id]);
  const decide = (decision: AssumptionDecision) => {
    setDecided((current) => ({ ...current, [decision.id]: decision.kind }));
    onAssumptionDecision?.(decision);
  };

  const regenerateLeft = regenerateUsed < regenerateLimit && actions.includes("regenerate");
  const showAcceptAsIs = actions.includes("accept_as_is") || regenerateUsed >= regenerateLimit;
  const noteRequired = mode !== null;
  const canSubmitNote = note.trim().length > 0 && !busy;

  const submitNote = () => {
    if (!mode || !canSubmitNote) return;
    onAction(mode, note.trim());
    setNote("");
    setMode(null);
  };

  return (
    <div className="bg-white border-2 border-[#DCD8F0] rounded-[16px] p-4 flex flex-col gap-3 shadow-[0_8px_24px_rgba(106,98,196,0.08)]" aria-label="Cổng chốt">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10.5px] font-extrabold text-[#6A62C4] tracking-wider uppercase">Cổng chốt</div>
          <h4 className="font-extrabold text-[13px] text-[#191817]">{phaseLabel ?? `${stepId} · ${stepLabel(stepId)}`}</h4>
        </div>
        <span className="text-[11px] font-bold text-[#6B6862]" data-testid="regenerate-count">
          Regenerate {regenerateUsed}/{regenerateLimit}
        </span>
      </div>

      {/* Lớp 4 "Bạn vừa có" — gate nói nội dung, không chỉ con số (WP-5) */}
      {groups.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#6B6862]">Bạn vừa có</span>
          {groups.map((group) => (
            <div key={group.key} className="text-[12px] text-[#191817]">
              <span className="font-bold">{group.label}</span>
              <span className="text-[#4B4842]">
                {": "}
                {group.items
                  .slice(0, 5)
                  .map((item) => item.title_vi)
                  .join(", ")}
                {group.items.length > 5 ? `, …(+${group.items.length - 5})` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {payload && summary.length === 0 && payload.no_change_reason && (
        <p className="text-[12px] text-[#6B6862]">Bước này không thay đổi tài liệu: {payload.no_change_reason}</p>
      )}

      {assumptions.length > 0 && (
        <div className="flex flex-col gap-1.5 bg-[#FBF4E4] rounded-[10px] p-2.5">
          <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A6D1F]">
            Cần bạn xem: {assumptions.length} giả định mới
          </span>
          {assumptions.map((assumption) => (
            <div key={assumption.id} className="flex flex-col gap-1">
              <span className="text-[12px] text-[#191817]">
                <span className="font-bold">{assumption.id}</span> {assumption.text}
                {assumption.conflict ? <em className="text-[#B03030]"> · mâu thuẫn với: {assumption.conflict}</em> : null}
              </span>
              {editing?.id === assumption.id ? (
                <div className="flex gap-1.5">
                  <input
                    aria-label={`Sửa giả định ${assumption.id}`}
                    value={editing.text}
                    onChange={(e) => setEditing({ id: assumption.id, text: e.target.value })}
                    className="flex-1 px-2 py-1 bg-white border border-[#E5E3DF] rounded-[8px] text-[12px] outline-none"
                  />
                  <button
                    type="button"
                    disabled={editing.text.trim().length === 0}
                    onClick={() => decide({ kind: "edit", id: assumption.id, statement: editing.text.trim() })}
                    className="px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-[#191817] text-white disabled:opacity-50 cursor-pointer"
                  >
                    Lưu
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => decide({ kind: "confirm", id: assumption.id })}
                    className="px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-[#1F7A45] text-white cursor-pointer"
                  >
                    Đúng
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ id: assumption.id, text: assumption.text })}
                    className="px-2.5 py-1 rounded-full text-[11.5px] font-bold border border-[#ECEAE5] text-[#191817] cursor-pointer"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => decide({ kind: "reject", id: assumption.id })}
                    className="px-2.5 py-1 rounded-full text-[11.5px] font-bold border border-[#F0C4C4] text-[#B03030] cursor-pointer"
                  >
                    Bỏ
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {payload?.flags && (
        <p className="text-[11.5px] text-[#4B4842]">
          Kiểm tra: cờ đỏ {deltaText(payload.flags.red - payload.flags.red_delta, payload.flags.red)} · cờ vàng{" "}
          {deltaText(payload.flags.yellow - payload.flags.yellow_delta, payload.flags.yellow)}
          {payload.doc_progress ? ` · tài liệu ${payload.doc_progress.before}% → ${payload.doc_progress.after}%` : ""}
        </p>
      )}

      {(payload?.duration_ms !== undefined || payload?.credits_used !== undefined) && (
        <p className="text-[11px] text-[#6B6862]">
          {payload.duration_ms !== undefined ? `${Math.round(payload.duration_ms / 1000)} giây` : ""}
          {payload.duration_ms !== undefined && payload.credits_used !== undefined ? " · " : ""}
          {payload.credits_used !== undefined ? `${Math.round(payload.credits_used)} credit` : ""}
        </p>
      )}

      {blockingFlags && blockingFlags.length > 0 && (
        <div className="flex flex-col gap-1.5 bg-[#FDF2F2] rounded-[10px] p-2.5" role="alert">
          <span className="text-[11.5px] font-bold text-[#B03030]">
            Chưa ký được baseline — còn {blockingFlags.length} cờ đỏ chưa xử lý
          </span>
          {blockingFlags.map((flag) => (
            <div key={flag.id} className="text-[11.5px] text-[#4B4842] flex items-center gap-2">
              <span className="flex-1 min-w-0">{flag.message}</span>
              {flag.remediation_step && onGoToStep && (
                <button type="button" onClick={() => onGoToStep(flag.remediation_step as string)} className="font-bold underline cursor-pointer shrink-0">
                  → {flag.remediation_step}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !actions.includes("accept")}
          onClick={() => onAction("accept")}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-[#1F7A45] text-white hover:bg-[#19663A] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          ✓ Accept
        </button>
        <button
          type="button"
          disabled={busy || !actions.includes("revision")}
          onClick={() => setMode(mode === "revision" ? null : "revision")}
          aria-pressed={mode === "revision"}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#ECEAE5] text-[#191817] hover:bg-[#FAF9F7] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          ✎ Request revision
        </button>
        <button
          type="button"
          disabled={busy || !regenerateLeft}
          onClick={() => onAction("regenerate")}
          title={regenerateLeft ? undefined : "Đã hết lượt Regenerate"}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#DCD8F0] text-[#6A62C4] hover:bg-[#F2F1FB] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          ↻ Regenerate ({regenerateUsed}/{regenerateLimit})
        </button>
        {showAcceptAsIs && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode(mode === "accept_as_is" ? null : "accept_as_is")}
            aria-pressed={mode === "accept_as_is"}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#F0DFB4] text-[#8A6D1F] bg-[#FBF4E4] hover:bg-[#F7EBCF] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Accept as-is
          </button>
        )}
      </div>

      {noteRequired && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`gate-note-${stepId}`} className="text-[11.5px] font-semibold text-[#6B6862]">
            {mode === "revision" ? "Cần sửa gì?" : "Lý do chấp nhận bản hiện tại (bắt buộc)"}
          </label>
          <textarea
            id={`gate-note-${stepId}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#E5E3DF] focus:border-[#6A62C4] rounded-[10px] text-[12px] outline-none resize-none"
          />
          <button
            type="button"
            disabled={!canSubmitNote}
            onClick={submitNote}
            className="self-end px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-[#191817] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {mode === "revision" ? "Gửi yêu cầu sửa" : "Xác nhận Accept as-is"}
          </button>
        </div>
      )}
    </div>
  );
}
