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
  /** Tóm tắt của CẢ giai đoạn khi đây là cổng chốt cuối phase (R2) — gồm cả bước đã tự Accept. */
  phaseSummary?: ChangeSummary[];
  /** Toàn bộ payload `gate_ready` — Lớp 4 "Bạn vừa có" (tóm tắt, cờ, giả định, thời gian, credit). */
  payload?: GateReadyEvent | null;
  /**
   * Lý do AI đặt từng giả định (`assumptions[].rationale` trong Spine), theo id. `gate_ready` chỉ mang câu giả định,
   * không mang lý do — thiếu dòng này user phải xác nhận một điều mà không biết AI dựa vào đâu.
   */
  assumptionReasons?: Readonly<Record<string, string>>;
  /**
   * Giả định còn "chưa xác nhận" trong Spine (kể cả của bước trước). `gate_ready` chỉ mang giả định MỚI của bước này —
   * user bấm Duyệt ở bước trước mà chưa bấm Đúng/Bỏ thì giả định đó phải hiện lại ở cổng kế, không trôi mất.
   */
  pendingAssumptions?: AssumptionBrief[];
  /** Duyệt = xác nhận luôn các giả định đang hiện mà user chưa Bỏ/Sửa. Chờ ghi xong rồi mới chốt bước. */
  onConfirmAssumptions?: (ids: string[]) => Promise<unknown>;
  /** Cờ đỏ đang chặn ký baseline (422 BASELINE_BLOCKED khi Accept ở S-9.5). */
  blockingFlags?: BlockingFlag[];
  /**
   * "Sửa" (FLF-221) gọi AI dịch câu user gõ rồi ghi cả hai bản — trả `false` khi lỗi để thẻ giữ nguyên ô sửa và chữ
   * user đã gõ. Đúng/Bỏ không cần chờ.
   */
  onAssumptionDecision?: (decision: AssumptionDecision) => void | Promise<boolean | void>;
  onGoToStep?: (stepId: string) => void;
  /** Lượt chạy vừa rồi có ghi được op nào vào Spine không (L11b). */
  wroteOps?: boolean;
  /** Mục step này nuôi mà chạy xong vẫn trống — accept cũng không đóng được cờ `section_empty` (L11b). */
  emptySections?: { section_id: string; title: string }[];
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

/** Field lẻ của `project`: BE ghi tiêu đề dạng "<field>: <giá trị>" — dịch cả hai sang lời thường. */
const PROJECT_FIELD_VI: Record<string, string> = {
  name: "Tên dự án",
  system_name: "Tên hệ thống",
  vision: "Tầm nhìn",
  goals: "Mục tiêu",
  type: "Loại dự án",
  domain: "Lĩnh vực",
  complexity: "Độ phức tạp",
  form_factor: "Nền tảng",
  stakes: "Mức độ quan trọng",
  release_scope: "Phạm vi phát hành",
  review_mode: "Chế độ duyệt",
};

const PROJECT_VALUE_VI: Record<string, string> = {
  small: "Nhỏ",
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  large: "Lớn",
  web_app: "Web",
  web_application: "Ứng dụng web",
  mobile_app: "Ứng dụng di động",
  desktop_app: "Ứng dụng máy tính",
  api_service: "Dịch vụ API",
  cli: "Dòng lệnh (CLI)",
  embedded: "Hệ thống nhúng",
  internal: "Nội bộ",
  production: "Sản phẩm thật",
  regulated: "Chịu quản lý pháp lý",
  strict: "Mọi bước",
  balanced: "Cuối giai đoạn",
  fast: "Cuối giai đoạn",
};

/** `"complexity: small"` ⇒ `"Độ phức tạp: Nhỏ"`; tiêu đề khác giữ nguyên. */
export const projectFieldText = (title: string): string => {
  const match = /^([a-z_]+):\s*(.*)$/.exec(title.trim());
  if (!match) return title;
  const [, field, value] = match;
  const label = PROJECT_FIELD_VI[field];
  if (!label) return title;
  return `${label}: ${PROJECT_VALUE_VI[value.trim()] ?? value}`;
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
  phaseSummary,
  payload = null,
  assumptionReasons,
  pendingAssumptions = [],
  onConfirmAssumptions,
  blockingFlags,
  onAssumptionDecision,
  onGoToStep,
  wroteOps = true,
  emptySections = [],
  onAction,
}: GateCardProps) {
  const [mode, setMode] = useState<"revision" | "accept_as_is" | null>(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [decided, setDecided] = useState<Record<string, "confirm" | "reject" | "edit">>({});
  /** Giả định đang chờ AI dịch bản sửa — ô sửa khoá lại cho tới khi xong. */
  const [savingEdit, setSavingEdit] = useState<string | null>(null);

  // Cổng chốt cuối giai đoạn nói về cả giai đoạn, không chỉ bước cuối
  const summary = phaseSummary ?? payload?.summary ?? [];
  const groups = groupSummary(summary);
  const fresh = payload?.new_assumptions ?? [];
  const assumptions: AssumptionBrief[] = [...fresh, ...pendingAssumptions.filter((p) => !fresh.some((a) => a.id === p.id))].filter(
    (a) => !decided[a.id]
  );
  /** Duyệt (kể cả "chấp nhận như hiện tại") ⇒ xác nhận các giả định còn lại trước, rồi mới chốt bước. */
  const act = async (action: GateAction, actionNote?: string) => {
    if ((action === "accept" || action === "accept_as_is") && assumptions.length > 0 && onConfirmAssumptions) {
      const ids = assumptions.map((a) => a.id);
      setDecided((current) => ({ ...current, ...Object.fromEntries(ids.map((id) => [id, "confirm" as const])) }));
      await onConfirmAssumptions(ids);
    }
    if (actionNote === undefined) onAction(action);
    else onAction(action, actionNote);
  };
  const shownGroups = (payload?.new_assumptions ?? []).length > 0 ? groups.filter((g) => !g.key.endsWith("|assumptions")) : groups;
  // Dòng kiểm tra chỉ đáng đọc khi có gì đổi: cờ mới hoặc % tài liệu tăng/giảm
  const flagsChanged =
    payload?.flags !== undefined &&
    (payload.flags.red_delta !== 0 ||
      payload.flags.yellow_delta !== 0 ||
      (payload.doc_progress !== undefined && payload.doc_progress !== null && payload.doc_progress.before !== payload.doc_progress.after));
  const decide = async (decision: AssumptionDecision) => {
    if (decision.kind !== "edit") {
      setDecided((current) => ({ ...current, [decision.id]: decision.kind }));
      void onAssumptionDecision?.(decision);
      return;
    }
    setSavingEdit(decision.id);
    const ok = await onAssumptionDecision?.(decision);
    setSavingEdit(null);
    if (ok === false) return;
    setEditing(null);
    setDecided((current) => ({ ...current, [decision.id]: "edit" }));
  };

  // AI không được gọi (bước chỉ chốt một field đã có từ bước trước): ghi 0 op là đúng, không phải lỗi — không cảnh báo
  const nothingToDo = payload?.calls_used === 0 && Boolean(payload.no_change_reason) && emptySections.length === 0;
  const warnNoOps = !wroteOps && !nothingToDo;

  const regenerateLeft = regenerateUsed < regenerateLimit && actions.includes("regenerate");
  const showAcceptAsIs = actions.includes("accept_as_is") || regenerateUsed >= regenerateLimit;
  const noteRequired = mode !== null;
  const canSubmitNote = note.trim().length > 0 && !busy;

  const submitNote = () => {
    if (!mode || !canSubmitNote) return;
    void act(mode, note.trim());
    setNote("");
    setMode(null);
  };

  return (
    <div className="bg-surface-container-lowest rounded-[16px] p-4 flex flex-col gap-3" aria-label="Cổng chốt">
      <h4 className="font-extrabold text-[13px] text-[#191817]">{phaseLabel ?? `${stepId} · ${stepLabel(stepId)}`}</h4>

      {/* L11b: trước đây lô op rỗng vẫn tới gate y như một lượt chạy thành công — user Accept, cờ đỏ vẫn treo,
          bấm "Mở lại" lại rơi vào đúng vòng đó. Nói thẳng ra ở đây kèm lối khác. */}
      {(warnNoOps || emptySections.length > 0) && (
        <div role="status" className="bg-[#FBF4E4] border border-[#F0DFB4] rounded-[12px] px-3 py-2.5 flex flex-col gap-1 text-[11.5px] text-[#8A6D1F]">
          <p className="font-bold text-[#191817]">
            {wroteOps ? "Chạy xong nhưng mục vẫn trống" : "AI không soạn được nội dung nào ở lượt này"}
          </p>
          {emptySections.length > 0 && (
            <p>
              Còn trống:{" "}
              {emptySections.map((s) => (
                <span key={s.section_id} className="font-semibold text-[#33312D]">
                  {s.title}{" "}
                  <code className="text-[10.5px]">{s.section_id}</code>
                </span>
              ))}
              . Duyệt sẽ chốt bước nhưng cờ đỏ <code>section_empty</code> vẫn treo, và chạy lại cũng cho kết quả như
              vậy nếu tài liệu gốc không có dữ liệu cho mục đó.
            </p>
          )}
          <p>
            Lối khác: <b>Yêu cầu sửa</b> để tả rõ cần gì, tự viết nội dung qua chat, hoặc waive cờ ở panel
            Verification nếu mục này thật sự không áp dụng.
          </p>
        </div>
      )}

      {/* Lớp 4 "Bạn vừa có" — gate nói nội dung, không chỉ con số (WP-5). Giả định mới đã có khung xác nhận
          riêng bên dưới ⇒ không liệt kê lần hai ở đây. */}
      {shownGroups.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#6B6862]">AI đã ghi nhận</span>
          {shownGroups.map((group) => (
            <div key={group.key} className="text-[12px] text-[#191817]">
              <span className="font-bold">{group.label}</span>
              <span className="text-[#4B4842]">
                {": "}
                {group.items
                  .slice(0, 5)
                  .map((item) => (item.collection === "project" ? projectFieldText(item.title_vi) : item.title_vi))
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
            AI tự giả định — bạn xác nhận giúp
          </span>
          {onConfirmAssumptions ? (
            <span className="text-[11px] text-[#6B6862]">Bấm Duyệt là đồng ý luôn những giả định bạn chưa Bỏ hay Sửa.</span>
          ) : null}
          {assumptions.map((assumption) => (
            <div key={assumption.id} className="flex flex-col gap-1">
              <span className="text-[12px] text-[#191817]">
                {assumption.text_vi ?? assumption.text}
                {assumption.conflict ? <em className="text-[#B03030]"> · mâu thuẫn với: {assumption.conflict}</em> : null}
              </span>
              {assumptionReasons?.[assumption.id] ? (
                <span className="text-[11.5px] leading-relaxed text-[#6B6862]">Vì sao: {assumptionReasons[assumption.id]}</span>
              ) : null}
              {editing?.id === assumption.id ? (
                <div className="flex gap-1.5">
                  <input
                    aria-label={`Sửa giả định ${assumption.id}`}
                    value={editing.text}
                    disabled={savingEdit === assumption.id}
                    onChange={(e) => setEditing({ id: assumption.id, text: e.target.value })}
                    className="flex-1 px-2 py-1 bg-white border border-[#E5E3DF] rounded-[8px] text-[12px] outline-none"
                  />
                  <button
                    type="button"
                    disabled={editing.text.trim().length === 0 || savingEdit === assumption.id}
                    onClick={() => void decide({ kind: "edit", id: assumption.id, statement: editing.text.trim() })}
                    className="px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-[#191817] text-white disabled:opacity-50 cursor-pointer"
                  >
                    {savingEdit === assumption.id ? "Đang lưu…" : "Lưu"}
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => void decide({ kind: "confirm", id: assumption.id })}
                    className="px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-[#1F7A45] text-white cursor-pointer"
                  >
                    Đúng
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ id: assumption.id, text: assumption.text_vi ?? assumption.text })}
                    className="px-2.5 py-1 rounded-full text-[11.5px] font-bold border border-[#ECEAE5] text-[#191817] cursor-pointer"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => void decide({ kind: "reject", id: assumption.id })}
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

      {payload?.table && payload.table.rows.length > 0 && (
        <details className="bg-[#FAF9F7] border border-[#ECEAE5] rounded-[10px] p-2.5">
          <summary className="text-[11.5px] font-bold text-[#191817] cursor-pointer">
            {payload.table.title_vi} ({payload.table.rows.length + payload.table.truncated} dòng)
          </summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  {payload.table.columns.map((column) => (
                    <th key={column} className="border border-[#ECEAE5] bg-white px-2 py-1 text-left font-bold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="border border-[#ECEAE5] px-2 py-1 align-top bg-white">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payload.table.truncated > 0 && (
            <p className="text-[11px] text-[#6B6862] mt-1">và {payload.table.truncated} dòng nữa — xem đủ trong tài liệu.</p>
          )}
        </details>
      )}

      {payload?.flags && flagsChanged && (
        <p className="text-[11.5px] text-[#4B4842]">
          Kiểm tra: cờ đỏ {deltaText(payload.flags.red - payload.flags.red_delta, payload.flags.red)} · cờ vàng{" "}
          {deltaText(payload.flags.yellow - payload.flags.yellow_delta, payload.flags.yellow)}
          {payload.doc_progress ? ` · tài liệu ${payload.doc_progress.before}% → ${payload.doc_progress.after}%` : ""}
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !actions.includes("accept")}
          onClick={() => void act("accept")}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-[#1F7A45] text-white hover:bg-[#19663A] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          ✓ Duyệt, sang bước tiếp
        </button>
        <button
          type="button"
          disabled={busy || !actions.includes("revision")}
          onClick={() => setMode(mode === "revision" ? null : "revision")}
          aria-pressed={mode === "revision"}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#ECEAE5] text-[#191817] hover:bg-[#FAF9F7] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          ✎ Yêu cầu sửa
        </button>
        <button
          type="button"
          disabled={busy || !regenerateLeft}
          onClick={() => onAction("regenerate")}
          title={regenerateLeft ? "AI soạn lại bước này từ đầu" : "Đã hết lượt làm lại"}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#DCD8F0] text-[#6A62C4] hover:bg-[#F2F1FB] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          ↻ Làm lại · còn {Math.max(0, regenerateLimit - regenerateUsed)} lần
        </button>
        {showAcceptAsIs && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode(mode === "accept_as_is" ? null : "accept_as_is")}
            aria-pressed={mode === "accept_as_is"}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#F0DFB4] text-[#8A6D1F] bg-[#FBF4E4] hover:bg-[#F7EBCF] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Duyệt như hiện tại
          </button>
        )}
        {payload?.credits_used !== undefined && (
          <span className="ml-auto text-[11px] text-[#6B6862]">{Math.round(payload.credits_used)} credit</span>
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
            {mode === "revision" ? "Gửi yêu cầu sửa" : "Xác nhận duyệt như hiện tại"}
          </button>
        </div>
      )}
    </div>
  );
}
