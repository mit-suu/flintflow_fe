"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CR_MAX_MATERIALS, NEW_CR_SOURCE_KINDS, type CrLocation, type CrStatus } from "@/types/change-request";
import { isFailing, type CrChat, type CrChatBusy, type CrChatSource } from "../../hooks/mode1/useCrChat";
import ClarifyPanel from "./ClarifyPanel";
import { AssumptionsNote, MaterialAdder, MaterialList } from "./CrMaterials";
import FieldChanges from "./FieldChanges";
import { CR_SOURCE_LABELS, CR_STATUS_LABELS } from "./labels";
import PausedBanner from "./PausedBanner";
import ValueEditor from "./ValueEditor";
import { humanizeText, pathLabel, sectionTitle } from "./spine-labels";

const BUSY_TEXT: Record<CrChatBusy, string> = {
  create: "Đang mở change request…",
  clarify: "AI đang đọc yêu cầu và kiểm xem còn thiếu gì…",
  impact: "Đang tìm các phần liên quan trong tài liệu…",
  propose: "AI đang soạn đề xuất sửa…",
  verify: "Đang kiểm tra đề xuất…",
  submit: "Đang gửi cho Lead…",
  revise: "Đang khoá lại để sửa…",
  resume: "Đang chạy tiếp…",
  amend: "Đang gộp lệnh sửa vào change request…",
  answers: "Đang gửi câu trả lời…",
  material: "Đang đọc tài liệu…",
  reject: "Đang bỏ đề xuất…",
  redraft: "AI đang soạn lại đề xuất…",
  manual: "Đang lưu bản bạn tự sửa…",
};

function UserBubble({ children }: { children: ReactNode }) {
  return <div className="self-end max-w-[85%] bg-primary-soft text-on-surface rounded-[14px] rounded-br-[4px] px-3 py-2 text-[13px] whitespace-pre-wrap">{children}</div>;
}

function AiBubble({ step, children, label }: { step?: string; children: ReactNode; label?: string }) {
  return (
    <div className="self-start w-full bg-surface-container-lowest border border-outline-variant rounded-[14px] rounded-bl-[4px] px-3 py-2.5 text-[12.5px] text-on-surface flex flex-col gap-2" aria-label={label}>
      {step && <p className="text-[10.5px] font-bold uppercase tracking-wider text-primary-hover">{step}</p>}
      {children}
    </div>
  );
}

const btn = "px-3 py-1 rounded-[8px] text-[12px] font-bold disabled:opacity-50 cursor-pointer";

/** 3.1 trong chat: chọn nguồn + người yêu cầu cho lệnh sửa đầu tiên. */
function RequesterCard({ me, busy, onStart, onCancel }: { me: string; busy: boolean; onStart: (s: CrChatSource) => void; onCancel: () => void }) {
  const [other, setOther] = useState(false);
  const [kind, setKind] = useState<CrChatSource["kind"]>("stakeholder_email");
  const [requester, setRequester] = useState("");
  const [ref, setRef] = useState("");
  return (
    <AiBubble step="Mở change request" label="Chọn người yêu cầu">
      <p>Mọi thay đổi sau khi import đi qua change request. Ai yêu cầu thay đổi này, từ nguồn nào?</p>
      {!other ? (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" disabled={busy || !me} onClick={() => onStart({ kind: "verbal", requester: me })} className={`${btn} bg-on-surface text-surface`}>
            {me ? `${me} · yêu cầu miệng` : "Tôi · yêu cầu miệng"}
          </button>
          <button type="button" disabled={busy} onClick={() => setOther(true)} className={`${btn} border border-outline-variant bg-white text-on-surface`}>
            Người / nguồn khác…
          </button>
          <button type="button" disabled={busy} onClick={onCancel} className={`${btn} text-on-surface-muted`}>
            Huỷ
          </button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (requester.trim()) onStart({ kind, requester, ref });
          }}
        >
          <select aria-label="Nguồn" value={kind} onChange={(e) => setKind(e.target.value as CrChatSource["kind"])} className="px-2 py-1.5 rounded-[8px] border border-outline-variant bg-white text-[12.5px]">
            {NEW_CR_SOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {CR_SOURCE_LABELS[k]}
              </option>
            ))}
          </select>
          <input aria-label="Người yêu cầu" value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="Người yêu cầu, vd: PM Lan" className="px-2 py-1.5 rounded-[8px] border border-outline-variant bg-white text-[12.5px]" />
          <input aria-label="Tham chiếu nguồn" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Tham chiếu (không bắt buộc), vd: Email 23/09" className="px-2 py-1.5 rounded-[8px] border border-outline-variant bg-white text-[12.5px]" />
          <div className="flex gap-1.5 justify-end">
            <button type="button" onClick={() => setOther(false)} className={`${btn} text-on-surface-muted`}>
              Quay lại
            </button>
            <button type="submit" disabled={busy || !requester.trim()} className={`${btn} bg-on-surface text-surface`}>
              Mở change request
            </button>
          </div>
        </form>
      )}
    </AiBubble>
  );
}

/** Thanh tiến độ 5 bước của change request trong chat — bước đang ở tô đậm, bước đã qua có dấu ✓. */
const STEPS = ["Làm rõ", "Phần liên quan", "Đề xuất", "Kiểm tra", "Gửi Lead"] as const;
const stepIndex = (status: CrStatus): number =>
  status === "draft" || status === "clarifying" || status === "awaiting_answers"
    ? 0
    : status === "impact_review"
      ? 1
      : status === "proposing"
        ? 2
        : status === "verifying" || status === "manual_fix"
          ? 3
          : 4;

function StepTracker({ status }: { status: CrStatus }) {
  const current = stepIndex(status);
  return (
    <ol className="flex items-center gap-1 text-[10.5px] font-bold" aria-label="Tiến độ change request">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-1 min-w-0" aria-current={i === current ? "step" : undefined}>
          <span
            className={`shrink-0 w-4 h-4 grid place-items-center rounded-full text-[9.5px] ${
              i < current ? "bg-[#1F7A45] text-white" : i === current ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-muted"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </span>
          <span className={`truncate ${i === current ? "text-on-surface" : "text-on-surface-muted"}`}>{label}</span>
          {i < STEPS.length - 1 && <span aria-hidden className="w-2 h-px bg-outline-variant shrink-0" />}
        </li>
      ))}
    </ol>
  );
}

/** Ô gõ hướng sửa ngay trong thẻ (3.9) — AI soạn lại đúng phần đó. */
function RedraftBox({ loc, chat, onClose, autoFocus = true }: { loc: CrLocation; chat: CrChat; onClose?: () => void; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const busy = chat.busy !== null;
  return (
    <form
      className="flex flex-col gap-1.5"
      aria-label={`Hướng sửa lại ${loc.location_id}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        if (await chat.redraft(loc.location_id, text.trim())) setText("");
      }}
    >
      <textarea
        autoFocus={autoFocus}
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={`Hướng sửa cho ${pathLabel(loc.path)}`}
        placeholder="Muốn sửa thế nào? vd: Giữ nguyên tên, chỉ đổi ngưỡng thành 1 giây"
        className="w-full px-2.5 py-1.5 rounded-[8px] border border-outline-variant bg-white text-[12.5px]"
      />
      <div className="flex gap-1.5 justify-end">
        {onClose && (
          <button type="button" onClick={onClose} className={`${btn} text-on-surface-muted`}>
            Huỷ
          </button>
        )}
        <button type="submit" disabled={busy || !text.trim()} className={`${btn} bg-on-surface text-surface`}>
          {chat.busy === "redraft" ? "AI đang soạn lại…" : "AI soạn lại"}
        </button>
      </div>
    </form>
  );
}

/**
 * Chỗ sửa một phần (3.9): hai cách — **Nhờ AI soạn lại** (gõ hướng sửa) hoặc **Tự sửa** (sửa thẳng nội dung theo từng trường
 * / đoạn). Bản tự sửa tính luôn là đã đồng ý.
 */
function EditPanel({ loc, chat, editing }: { loc: CrLocation; chat: CrChat; editing: boolean }) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const oldText = loc.proposal?.old_text ?? loc.current_text;
  const tab = (value: "ai" | "manual", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => setMode(value)}
      className={`px-2.5 py-1 rounded-[8px] text-[12px] font-bold ${mode === value ? "bg-on-surface text-surface" : "text-on-surface-muted hover:bg-surface-container"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] bg-surface-container-lowest border border-outline-variant p-2">
      <div role="tablist" aria-label={`Cách sửa ${loc.location_id}`} className="flex gap-1">
        {tab("ai", "✨ Nhờ AI soạn lại")}
        {tab("manual", "✎ Tự sửa")}
      </div>
      {mode === "ai" ? (
        <RedraftBox loc={loc} chat={chat} autoFocus={editing} onClose={editing ? chat.cancelRedraft : undefined} />
      ) : (
        <ValueEditor
          oldText={oldText}
          startText={loc.proposal?.new_text ?? oldText}
          busy={chat.busy === "manual"}
          onSave={(value) => void chat.manualEdit(loc.location_id, value)}
          onCancel={editing ? chat.cancelRedraft : () => setMode("ai")}
        />
      )}
    </div>
  );
}

/**
 * Một phần trong bước đề xuất (3.6–3.9). Bốn trạng thái nhìn khác nhau: **AI chưa đề xuất** (vàng), **chưa đạt kiểm tra**
 * (viền đỏ + lý do + ô sửa lại mở sẵn), **chờ bạn quyết** (Đồng ý / Sửa lại / Bỏ), **đã đồng ý** (✓).
 */
function LocationCard({ loc, chat }: { loc: CrLocation; chat: CrChat }) {
  const p = loc.proposal;
  const failed = isFailing(loc);
  const missing = loc.conclusion === null;
  const accepted = !failed && !missing && chat.isAccepted(loc);
  const busy = chat.busy !== null;
  const editing = chat.redraftFor === loc.location_id;
  const openEdit = () => chat.startRedraft(loc.location_id);
  const tone = failed ? "border-[#E8A5A5] bg-[#FDF4F4]" : missing ? "border-[#EFD9A6] bg-[#FBF4E4]" : accepted ? "border-[#BFE6CE] bg-[#F3FAF6]" : "border-outline-variant bg-white";

  return (
    <article id={`cr-loc-${loc.location_id}`} className={`scroll-mt-4 rounded-[12px] border ${tone} p-2.5 flex flex-col gap-1.5`} aria-label={`Đề xuất ${loc.location_id}`}>
      <header className="flex items-start gap-2">
        <p className="flex-1 min-w-0 text-[12px] font-bold text-on-surface" title={loc.path}>
          {pathLabel(loc.path)}
          <span className="block text-[11px] font-medium text-on-surface-muted">{sectionTitle(loc.section_id, loc.section_title)}</span>
        </p>
        {failed ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#B03030] text-white text-[10.5px] font-bold">Chưa đạt</span>
        ) : missing ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#8A6D1F] text-white text-[10.5px] font-bold">Chưa có đề xuất</span>
        ) : accepted ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#1F7A45] text-white text-[10.5px] font-bold">✓ Đã đồng ý</span>
        ) : (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary-soft text-primary-hover text-[10.5px] font-bold">Chờ bạn quyết</span>
        )}
      </header>

      {missing && <p className="text-[#8A6D1F]">AI chưa đưa ra đề xuất cho phần này. Nhờ AI soạn, tự viết nội dung, hoặc bỏ qua nếu phần này không cần đổi.</p>}
      {loc.conclusion === "edit" && p && <FieldChanges oldText={p.old_text} newText={p.new_text} />}
      {loc.conclusion === "comment" && p?.comment_text && <p className="text-[#3B4FA8] bg-[#EEF1FB] rounded-[8px] px-2.5 py-1.5">💬 {humanizeText(p.comment_text)}</p>}
      {loc.reason && !missing && <p className="text-on-surface-muted">Lý do: {humanizeText(loc.reason)}</p>}
      <AssumptionsNote assumptions={p?.assumptions} />

      {failed && (
        <div className="rounded-[8px] bg-white border border-[#F2CACA] px-2.5 py-1.5" aria-label="Lý do chưa đạt">
          <p className="font-bold text-[#B03030]">Vì sao chưa đạt:</p>
          <ul className="list-disc pl-5 text-[#8A4141]">
            {loc.verify!.violations.map((v, i) => (
              <li key={i}>{humanizeText(v.message)}</li>
            ))}
          </ul>
        </div>
      )}
      {!failed && (loc.verify?.ai_flags.length ?? 0) > 0 && (
        <div className="rounded-[8px] bg-[#FBF4E4] px-2.5 py-1.5 text-[#8A6D1F]" aria-label="Lưu ý của AI">
          <p className="font-bold">Lưu ý (không chặn):</p>
          <ul className="list-disc pl-5">
            {loc.verify!.ai_flags.map((f, i) => (
              <li key={i}>{humanizeText(f.message)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Phần trượt / chưa có đề xuất: ô sửa lại mở sẵn — không phải đi tìm nút */}
      {chat.canRedraft && (failed || missing || editing) ? (
        <>
          <EditPanel loc={loc} chat={chat} editing={editing} />
          <div>
            <button type="button" disabled={busy} onClick={() => chat.reject(loc)} className={`${btn} text-[#B03030] px-0`}>
              {missing ? "Bỏ qua phần này (không cần đổi)" : "Bỏ phần này — không sửa nữa"}
            </button>
          </div>
        </>
      ) : !accepted && !missing ? (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" disabled={busy} onClick={() => chat.accept(loc)} className={`${btn} bg-[#1F7A45] text-white`}>
            Đồng ý
          </button>
          {chat.canRedraft && (
            <button type="button" disabled={busy} onClick={openEdit} className={`${btn} border border-outline-variant bg-white text-on-surface`}>
              Sửa lại
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => chat.reject(loc)} className={`${btn} border border-[#F2CACA] bg-white text-[#B03030]`}>
            Bỏ
          </button>
        </div>
      ) : null}
    </article>
  );
}

/** Phần không sửa (AI thấy không liên quan / bạn đã bỏ) — thu gọn, đưa lại được. */
function DroppedList({ locations, chat }: { locations: CrLocation[]; chat: CrChat }) {
  if (!locations.length) return null;
  return (
    <details className="text-[12px] text-on-surface-muted">
      <summary className="cursor-pointer font-semibold">Không sửa {locations.length} phần (không liên quan hoặc bạn đã bỏ)</summary>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {locations.map((l) => (
          <li key={l.location_id} className="flex flex-col gap-1">
            <span>
              <strong className="text-on-surface">{pathLabel(l.path)}</strong>
              {l.reason ? ` — ${humanizeText(l.reason)}` : ""}
            </span>
            {chat.redraftFor === l.location_id ? (
              <RedraftBox loc={l} chat={chat} onClose={chat.cancelRedraft} />
            ) : (
              chat.canRedraft && (
                <button type="button" disabled={chat.busy !== null} onClick={() => chat.startRedraft(l.location_id)} className="self-start underline">
                  Đưa lại — nhờ AI soạn đề xuất
                </button>
              )
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Mode 1 v3 phase 8 — luồng change request trong khung chat bên trái. Dựng lại hoàn toàn từ `CrDetail` (không lưu tin
 * nhắn riêng): lệnh sửa của người dùng ⇒ ① làm rõ (câu hỏi + gợi ý + tài liệu) ⇒ ② phần liên quan ⇒ ③ đề xuất — mọi
 * phần cần quyết, kể cả phần AI bỏ sót và phần trượt kiểm (Đồng ý / Sửa lại / Bỏ) ⇒ ④ kiểm ⇒ Gửi cho Lead.
 */
export default function Mode1CrThread({ projectId, chat, me }: { projectId: string; chat: CrChat; me: string }) {
  const d = chat.detail;
  const busy = chat.busy !== null;

  const errorBox = chat.error && (
    <div role="alert" className="bg-error-container text-error rounded-control px-3 py-2 text-[12px] flex items-start gap-2">
      <span className="flex-1">{chat.error}</span>
      <button type="button" onClick={chat.clearError} aria-label="Đóng thông báo lỗi" className="font-bold">
        ✕
      </button>
    </div>
  );
  const busyLine = chat.busy && (
    <p className="self-start text-[12px] text-on-surface-muted italic" role="status">
      {BUSY_TEXT[chat.busy]}
    </p>
  );

  if (!d) {
    return (
      <div className="flex flex-col gap-3" aria-label="Sửa tài liệu qua chat">
        {chat.sent && (
          <AiBubble step="Đã gửi" label="Đã gửi cho Lead">
            <p>
              ✅ Đã gửi <strong>{chat.sent}</strong> cho Lead duyệt. Lead duyệt từng nhóm thay đổi ở{" "}
              <Link href={`/projects/${projectId}/change-requests/${chat.sent}`} className="underline font-semibold">
                trang change request
              </Link>
              ; tài liệu chỉ đổi sau khi được duyệt.
            </p>
            <p className="text-on-surface-muted">Gõ lệnh sửa mới để mở change request khác.</p>
          </AiBubble>
        )}
        {!chat.sent && !chat.pending && !chat.loading && (
          <AiBubble label="Hướng dẫn sửa tài liệu">
            <p>
              Gõ yêu cầu sửa tài liệu bên dưới, vd <em>“Thêm yêu cầu hiệu năng cho màn tra cứu”</em>. AI dẫn bạn từng bước: hỏi lại chỗ
              còn thiếu, chỉ ra phần liên quan, đề xuất sửa để bạn đồng ý — rồi gửi cho Lead duyệt.
            </p>
          </AiBubble>
        )}
        {chat.pending && (
          <>
            <UserBubble>{chat.pending}</UserBubble>
            <RequesterCard me={me} busy={busy} onStart={(s) => void chat.startCr(s)} onCancel={chat.cancelPending} />
          </>
        )}
        {busyLine}
        {errorBox}
      </div>
    );
  }

  const c = d.change_request;
  // Bước đề xuất hiện MỌI phần cần quyết — kể cả phần AI bỏ sót (chưa kết luận) và phần trượt kiểm
  const toReview = d.locations.filter((l) => l.conclusion !== "not_related" || isFailing(l));
  const dropped = d.locations.filter((l) => l.conclusion === "not_related" && !isFailing(l));
  const proposed = c.status !== "draft" && c.status !== "clarifying" && c.status !== "awaiting_answers" && c.status !== "impact_review";
  const settled = toReview.filter((l) => l.conclusion !== null && !isFailing(l) && chat.isAccepted(l)).length;
  const blockers = [...chat.failing, ...chat.unconcluded.filter((l) => !isFailing(l))];
  const jump = (locId: string) => document.getElementById(`cr-loc-${locId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  const materialsEditable = (c.status === "draft" || c.status === "awaiting_answers") && !c.paused;

  return (
    <div className="flex flex-col gap-3" aria-label={`Change request ${c.cr_id} trong chat`}>
      <div className="flex items-center gap-2 text-[11.5px] text-on-surface-muted">
        <span className="font-bold text-primary-hover">{c.cr_id}</span>
        <span>· {CR_STATUS_LABELS[c.status]}</span>
        <span className="truncate">· {c.requester}</span>
        <Link href={`/projects/${projectId}/change-requests/${c.cr_id}`} className="ml-auto underline shrink-0">
          Mở trang CR
        </Link>
      </div>
      <StepTracker status={c.status} />

      <UserBubble>{c.description}</UserBubble>
      {c.amendments.map((a, i) => (
        <UserBubble key={i}>{a.text}</UserBubble>
      ))}

      {(c.clarifications.length > 0 || d.pending_questions.length > 0) && (
        <AiBubble step="① Làm rõ" label="Làm rõ">
          <ClarifyPanel
            key={`${c.clarifications.length}:${d.pending_questions.join("|")}`}
            cr={c}
            pendingQuestions={c.status === "awaiting_answers" ? d.pending_questions : []}
            busy={chat.busy === "answers"}
            onAnswer={chat.answer}
            materials={
              materialsEditable ? (
                <MaterialAdder
                  busy={chat.busy === "material"}
                  full={c.materials.length >= CR_MAX_MATERIALS}
                  onAddText={(name, text) => chat.addMaterialText(name, text)}
                  onAddFile={(file) => chat.addMaterialFile(file)}
                />
              ) : undefined
            }
          />
        </AiBubble>
      )}
      {c.materials.length > 0 && (
        <MaterialList
          items={c.materials.map((m) => ({ key: m.material_id, name: m.name, kind: m.kind, text: m.text, truncated: m.truncated, round: m.round }))}
          onRemove={materialsEditable ? (id) => void chat.removeMaterial(id) : undefined}
          busy={chat.busy === "material"}
        />
      )}
      {c.missing_info.length > 0 && (
        <AiBubble label="Dữ kiện còn thiếu">
          <p className="text-[#8A6D1F] font-semibold">Còn thiếu dữ kiện — AI sẽ tự giả định và đánh dấu ở từng đề xuất:</p>
          <ul className="list-disc pl-5 text-[#8A6D1F]">
            {c.missing_info.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </AiBubble>
      )}

      {d.locations.length > 0 && (
        <AiBubble step={`② Phần liên quan (${d.locations.length})`} label="Phần liên quan">
          <ul className="list-disc pl-5">
            {d.locations.map((l) => (
              <li key={l.location_id} title={l.path}>
                {sectionTitle(l.section_id, l.section_title)} — {pathLabel(l.path)}
              </li>
            ))}
          </ul>
          {c.status === "impact_review" && !c.paused && (
            <div>
              <button type="button" disabled={busy} onClick={chat.proposeNow} className={`${btn} bg-on-surface text-surface`}>
                Tiếp tục — AI đề xuất sửa
              </button>
            </div>
          )}
        </AiBubble>
      )}

      {proposed && (toReview.length > 0 || dropped.length > 0) && (
        <AiBubble step={`③ Đề xuất sửa — đã chốt ${settled}/${toReview.length}`} label="Đề xuất sửa">
          {toReview.length > 0 ? (
            <p className="text-on-surface-muted">Xem từng phần: đồng ý, sửa lại theo ý bạn, hoặc bỏ. Chốt hết thì hệ thống tự kiểm tra.</p>
          ) : (
            <p className="text-on-surface-muted">AI thấy không phần nào cần sửa. Mở danh sách bên dưới để đưa lại phần nào bạn vẫn muốn sửa.</p>
          )}
          <div className="flex flex-col gap-2">
            {toReview.map((l) => (
              <LocationCard key={l.location_id} loc={l} chat={chat} />
            ))}
          </div>
          <DroppedList locations={dropped} chat={chat} />
        </AiBubble>
      )}

      {c.status === "manual_fix" && !c.paused && (
        <AiBubble step="④ Kiểm tra — cần bạn xử lý" label="Cần sửa">
          {blockers.length > 0 ? (
            <>
              <p>
                AI đã thử 2 lần mà <strong>{blockers.length} phần</strong> vẫn chưa đạt. Sửa lại (gõ hướng sửa ngay trong thẻ) hoặc bỏ từng phần
                — xong là hệ thống tự kiểm lại:
              </p>
              <ul className="flex flex-col gap-1">
                {blockers.map((l) => (
                  <li key={l.location_id}>
                    <button type="button" onClick={() => jump(l.location_id)} className="text-left underline text-[#B03030] font-semibold">
                      {pathLabel(l.path)}
                    </button>
                    <span className="text-on-surface-muted">
                      {" "}
                      — {l.conclusion === null ? "chưa có đề xuất" : humanizeText(l.verify?.violations[0]?.message ?? "chưa đạt")}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>Các phần chưa đạt đã được sửa lại hoặc bỏ. Đồng ý các đề xuất mới rồi kiểm lại.</p>
          )}
          <div>
            <button type="button" disabled={busy} onClick={chat.verifyNow} className={`${btn} bg-on-surface text-surface`}>
              {chat.busy === "verify" ? "Đang kiểm…" : "Kiểm lại ngay"}
            </button>
          </div>
        </AiBubble>
      )}
      {c.status === "ready_to_submit" && (
        <AiBubble step="④ Kiểm tra đạt" label="Sẵn sàng gửi">
          <p>✓ Mọi đề xuất đã đạt kiểm tra. Gửi cho Lead duyệt — tài liệu chỉ đổi sau khi Lead duyệt.</p>
          <div className="flex gap-1.5">
            <button type="button" disabled={busy} onClick={chat.submit} className={`${btn} btn-gradient-primary text-white`}>
              Gửi cho Lead
            </button>
          </div>
          <p className="text-on-surface-muted text-[11.5px]">Còn muốn sửa thêm? Gõ tiếp ở ô chat — lệnh mới được gộp vào {c.cr_id}.</p>
        </AiBubble>
      )}

      {c.paused && <PausedBanner paused={c.paused} what="Bước AI" busy={chat.busy === "resume"} onResume={chat.resume} />}
      {!busy && !c.paused && c.status !== "manual_fix" && chat.canContinue && (
        <div>
          <button type="button" onClick={chat.continueFlow} className={`${btn} border border-outline-variant bg-white text-on-surface`}>
            Tiếp tục
          </button>
        </div>
      )}
      {busyLine}
      {errorBox}
    </div>
  );
}
