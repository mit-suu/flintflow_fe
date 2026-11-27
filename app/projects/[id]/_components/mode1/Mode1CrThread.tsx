"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CR_MAX_MATERIALS, NEW_CR_SOURCE_KINDS, type CrDetail, type CrLocation } from "@/types/change-request";
import { canKeepViolations, fromApprovedPreview, inApprovedBatch, isFailing, isWarningPending, type CrChat, type CrChatPrefill, type CrChatSource } from "../../hooks/mode1/useCrChat";
import ClarifyPanel from "./ClarifyPanel";
import { AssumptionsNote, MaterialAdder, MaterialList } from "./CrMaterials";
import { OthersPending, ProposalDiff, useLocTitle } from "./LocationDisplay";
import OriginalDiagramChange, { diagramLocationTitle, isDiagramLocation } from "./OriginalDiagramChange";
import OriginalDiagramGroup from "./OriginalDiagramGroup";
import { useViewOnDocument } from "./cr-document-view-context";
import { useMode1Labels } from "./i18n";
import { diffLines, type DiffToken } from "@/lib/word-diff";
import PausedBanner from "./PausedBanner";
import CrTimeline from "./CrTimeline";
import { removedOfAll } from "./content-removal";

function UserBubble({ children }: { children: ReactNode }) {
  return <div className="self-end max-w-[85%] bg-primary-soft text-on-surface rounded-[14px] rounded-br-[4px] px-3 py-2 text-body whitespace-pre-wrap">{children}</div>;
}

/** `flat`: khung chứa các thẻ con đã có viền riêng (danh sách đề xuất, phần liên quan) ⇒ bỏ viền ngoài, chỉ giữ viền trong cùng. */
function AiBubble({ step, children, label, flat = false }: { step?: string; children: ReactNode; label?: string; flat?: boolean }) {
  return (
    <div
      className={`self-start w-full text-body text-on-surface flex flex-col gap-2 ${flat ? "py-1" : "bg-surface-container-lowest border border-outline-variant rounded-[14px] rounded-bl-[4px] px-3 py-2.5"}`}
      aria-label={label}
    >
      {step && <p className="text-caption font-bold uppercase tracking-wider text-primary-hover">{step}</p>}
      {children}
    </div>
  );
}

/** Bước "Phần liên quan" sau khi đã có đề xuất: một dòng thu gọn, bấm để xem lại danh sách. */
function CollapsedImpact({ step, label, children }: { step: string; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1" aria-label={label}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="self-start text-caption font-bold uppercase tracking-wider text-primary-hover cursor-pointer">
        {step} {open ? "▾" : "▸"}
      </button>
      {open && <div className="text-body text-on-surface">{children}</div>}
    </div>
  );
}

const btn = "px-3 py-1 rounded-[8px] text-body font-bold disabled:opacity-50 cursor-pointer";

/**
 * FLF-439: câu trả lời làm rõ là lời rút lại ("không đổi nữa") ⇒ hỏi lại trước khi huỷ CR (không quay lại được); người dùng
 * thật ra đang trả lời thì gửi đúng câu đó làm câu trả lời.
 */
function WithdrawCard({ crId, answers, busy, onCancelCr, onAnswer, onDismiss }: {
  crId: string;
  answers: readonly string[];
  busy: boolean;
  onCancelCr: () => void;
  onAnswer: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("mode1.crThread.withdraw");
  const text = answers.map((a) => a.trim()).filter(Boolean).join(" / ");
  return (
    <AiBubble step={t("step")} label={t("label")}>
      <p>{t("question", { crId, text })}</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={busy} onClick={onCancelCr} className={`${btn} border border-[#F2CACA] bg-white text-[#B03030]`}>
          {t("cancelCr", { crId })}
        </button>
        <button type="button" disabled={busy} onClick={onAnswer} className={`${btn} bg-on-surface text-surface`}>
          {t("answer")}
        </button>
        <button type="button" disabled={busy} onClick={onDismiss} className={`${btn} text-on-surface-muted`}>
          {t("dismiss")}
        </button>
      </div>
    </AiBubble>
  );
}

/** 3.1 trong chat: chọn nguồn + người yêu cầu cho lệnh sửa đầu tiên. */
function RequesterCard({ me, busy, onStart, onCancel, prefill }: { me: string; busy: boolean; onStart: (s: CrChatSource) => void; onCancel: () => void; prefill?: CrChatPrefill | null }) {
  const t = useTranslations("mode1.crThread.requester");
  const { crSource } = useMode1Labels();
  // FLF-375: lối vào khác đã biết nguồn (gap report, comment…) ⇒ mở sẵn form với đúng nguồn / tham chiếu / người yêu cầu
  const [other, setOther] = useState(!!prefill?.kind);
  const [kind, setKind] = useState<CrChatSource["kind"]>(prefill?.kind ?? "stakeholder_email");
  const [requester, setRequester] = useState(prefill?.requester ?? "");
  const [ref, setRef] = useState(prefill?.ref ?? "");
  return (
    <AiBubble step={t("step")} label={t("label")}>
      <p>{t("intro")}</p>
      {!other ? (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" disabled={busy || !me} onClick={() => onStart({ kind: "verbal", requester: me })} className={`${btn} bg-on-surface text-surface`}>
            {me ? t("meVerbal", { me }) : t("selfVerbal")}
          </button>
          <button type="button" disabled={busy} onClick={() => setOther(true)} className={`${btn} border border-outline-variant bg-white text-on-surface`}>
            {t("other")}
          </button>
          <button type="button" disabled={busy} onClick={onCancel} className={`${btn} text-on-surface-muted`}>
            {t("cancel")}
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
          <select aria-label={t("sourceAria")} value={kind} onChange={(e) => setKind(e.target.value as CrChatSource["kind"])} className="px-2 py-1.5 rounded-[8px] border border-outline-variant bg-white text-body">
            {NEW_CR_SOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {crSource(k)}
              </option>
            ))}
          </select>
          <input aria-label={t("requesterAria")} value={requester} onChange={(e) => setRequester(e.target.value)} placeholder={t("requesterPlaceholder")} className="px-2 py-1.5 rounded-[8px] border border-outline-variant bg-white text-body" />
          <input aria-label={t("refAria")} value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t("refPlaceholder")} className="px-2 py-1.5 rounded-[8px] border border-outline-variant bg-white text-body" />
          <div className="flex gap-1.5 justify-end">
            <button type="button" onClick={() => setOther(false)} className={`${btn} text-on-surface-muted`}>
              {t("back")}
            </button>
            <button type="submit" disabled={busy || !requester.trim()} className={`${btn} bg-on-surface text-surface`}>
              {t("open")}
            </button>
          </div>
        </form>
      )}
    </AiBubble>
  );
}

/** Ô gõ hướng sửa ngay trong thẻ (3.9) — AI soạn lại đúng phần đó. */
function RedraftBox({ loc, chat, onClose, autoFocus = true }: { loc: CrLocation; chat: CrChat; onClose?: () => void; autoFocus?: boolean }) {
  const t = useTranslations("mode1.crThread.redraft");
  const { pathLabel } = useMode1Labels();
  const [text, setText] = useState("");
  const busy = chat.busy !== null;
  return (
    <form
      className="flex flex-col gap-1.5"
      aria-label={t("formAria", { id: loc.location_id })}
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
        aria-label={t("inputAria", { path: pathLabel(loc.path) })}
        placeholder={t("placeholder")}
        className="w-full px-2.5 py-1.5 rounded-[8px] border border-outline-variant bg-white text-body"
      />
      <div className="flex gap-1.5 justify-end">
        {onClose && (
          <button type="button" onClick={onClose} className={`${btn} text-on-surface-muted`}>
            {t("cancel")}
          </button>
        )}
        <button type="submit" disabled={busy || !text.trim()} className={`${btn} bg-on-surface text-surface`}>
          {chat.busy === "redraft" ? t("busy") : t("submit")}
        </button>
      </div>
    </form>
  );
}

/**
 * Chỗ sửa một phần (3.9): gõ hướng sửa để AI soạn lại. FLF-375 (BF nguyên tắc 6): người dùng không sửa tay nội dung —
 * không còn tab "Tự sửa".
 */
function EditPanel({ loc, chat, editing }: { loc: CrLocation; chat: CrChat; editing: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] bg-surface-container-lowest border border-outline-variant p-2">
      <RedraftBox loc={loc} chat={chat} autoFocus={editing} onClose={editing ? chat.cancelRedraft : undefined} />
    </div>
  );
}

/**
 * FLF-375 — BF §3.2 "Hai người sửa cùng lúc": lúc xác nhận, người khác đã sửa đúng phần đề xuất định đổi ⇒ không ghi;
 * so sánh 3 cột (lúc AI soạn · hiện tại · đề xuất của bạn) + **AI soạn lại trên nội dung hiện tại** / **Bỏ yêu cầu**.
 * Không có nút ghi đè.
 */
function ConflictCard({ loc, chat, request }: { loc: CrLocation; chat: CrChat; request: string }) {
  const t = useTranslations("mode1.crThread.conflict");
  const locale = useLocale();
  const title = useLocTitle()(loc);
  const c = loc.conflict!;
  const busy = chat.busy !== null;
  const clock = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : null);
  const when = clock(c.changed_at);
  const since = clock(c.proposed_at);
  // BF §3.2: ① so với ② = người khác đã đổi gì; ① so với ③ = mình định đổi gì — chỗ khác nhau tô màu như Track Changes
  // FLF-480 (B18): so theo dòng rồi theo từ; dòng có "|" (hàng bảng) hiện từng ô một khung nhỏ
  const mark = (tk: DiffToken, i: number, ins: string) => (
    <span key={i}>
      {tk.kind === "same" ? tk.text : tk.kind === "del" ? <del className="text-[#B03030]">{tk.text}</del> : <ins className={`no-underline rounded px-0.5 ${ins}`}>{tk.text}</ins>}{" "}
    </span>
  );
  const marked = (body: string | null, ins: string) =>
    body === null ? (
      "-"
    ) : (
      <>
        {diffLines(c.at_proposal, body).map((tokens, li) => {
          const cells: DiffToken[][] = [[]];
          for (const tk of tokens) {
            if (tk.text === "|") cells.push([]);
            else cells[cells.length - 1].push(tk);
          }
          return cells.length > 1 ? (
            <div key={li} className="flex gap-1 my-0.5">
              {cells.map((cell, ci) => (
                <span key={ci} className="flex-1 min-w-0 rounded border border-outline-variant px-1">
                  {cell.map((tk, i) => mark(tk, i, ins))}
                </span>
              ))}
            </div>
          ) : (
            <div key={li}>{tokens.map((tk, i) => mark(tk, i, ins))}</div>
          );
        })}
      </>
    );
  const col = (head: string, body: ReactNode, tone: string) => (
    <div className={`rounded-[8px] border px-2 py-1.5 ${tone}`}>
      <p className="text-caption font-bold mb-0.5">{head}</p>
      <p className="whitespace-pre-wrap break-words">{body}</p>
    </div>
  );
  return (
    <article className="rounded-[12px] border border-[#EFD9A6] bg-[#FBF4E4] p-2.5 flex flex-col gap-2" aria-label={t("aria", { title })}>
      <p className="font-bold text-[#8A6D1F]">⚠ {when && since ? t("titleTimed", { title, who: c.changed_by, when, since }) : t("title", { title, who: c.changed_by })}</p>
      <div className="grid grid-cols-1 gap-1.5">
        {col(since ? `${t("atProposal")} (${since})` : t("atProposal"), c.at_proposal.includes("|") ? marked(c.at_proposal, "") : c.at_proposal, "border-outline-variant bg-white")}
        {col(t("current", { who: when ? `${c.changed_by}, ${when}` : c.changed_by }), marked(c.current, "bg-[#D6E4FA]"), "border-[#BFD3F2] bg-[#F2F6FD]")}
        {col(t("yours"), marked(c.proposal, "bg-[#CDEBD8]"), "border-[#BFE6CE] bg-[#F3FAF6]")}
      </div>
      <p className="text-caption text-on-surface-muted">{t("legend")}</p>
      <p className="text-caption text-on-surface-muted">{t("request", { request })}</p>
      {c.question ? (
        // BF §3.2: yêu cầu gốc đụng thẳng phần vừa sửa ⇒ AI hỏi lại trong chat, không tự chọn
        <div className="rounded-[8px] bg-white border border-[#EFD9A6] px-2.5 py-1.5 flex flex-col gap-1.5" aria-label={t("question")}>
          <p className="font-bold text-on-surface">🤖 {c.question.text}</p>
          <div className="flex flex-wrap gap-1.5">
            {c.question.suggestions.map((s) => (
              <button key={s} type="button" disabled={busy} onClick={() => void chat.redraft(loc.location_id, s)} className={`${btn} bg-on-surface text-surface`}>
                {s}
              </button>
            ))}
            <button type="button" disabled={busy} onClick={() => chat.startRedraft(loc.location_id)} className={`${btn} border border-outline-variant bg-white text-on-surface`}>
              {t("answerOther")}
            </button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {!c.question && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void chat.redraft(loc.location_id, t("redraftInstruction", { who: c.changed_by, request }))}
            className={`${btn} bg-on-surface text-surface`}
          >
            {t("redraft")}
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => chat.reject(loc, t("dropReason", { who: c.changed_by }))} className={`${btn} border border-outline-variant bg-white text-on-surface`}>
          {t("drop")}
        </button>
      </div>
    </article>
  );
}

/** FLF-495: nhảy sang pane tài liệu, tới đúng chỗ đề xuất này (chế độ xem CR trên tài liệu). */
function ViewOnDocumentLink({ locationId, onView }: { locationId: string; onView: (locationId: string) => void }) {
  const t = useTranslations("mode1.crThread.loc");
  return (
    <button type="button" onClick={() => onView(locationId)} className="mt-0.5 text-caption font-bold text-primary hover:underline cursor-pointer">
      {t("viewOnDocument")}
    </button>
  );
}

/**
 * Một phần trong bước đề xuất (3.6–3.9). Bốn trạng thái nhìn khác nhau: **AI chưa đề xuất** (vàng), **chưa đạt kiểm tra**
 * (viền đỏ + lý do + ô sửa lại mở sẵn), **chờ bạn quyết** (Đồng ý / Sửa lại / Bỏ), **đã đồng ý** (✓).
 */
function LocationCard({ loc, chat }: { loc: CrLocation; chat: CrChat }) {
  const t = useTranslations("mode1.crThread.loc");
  const tDiagram = useTranslations("mode1.originalDiagram");
  const { sectionTitle, humanizeText } = useMode1Labels();
  const locTitle = useLocTitle();
  const p = loc.proposal;
  const failed = isFailing(loc);
  const missing = loc.conclusion === null;
  const accepted = !failed && !missing && chat.isAccepted(loc);
  const busy = chat.busy !== null;
  const warned = isWarningPending(loc);
  const keepable = !!chat.detail && canKeepViolations(chat.detail, loc);
  const editing = chat.redraftFor === loc.location_id;
  const openEdit = () => chat.startRedraft(loc.location_id);
  // Sơ đồ gốc (§4.13): BE tự đề xuất, không có gì để AI soạn lại — chỉ Đồng ý (thay hình) hoặc Giữ hình gốc
  const diagram = isDiagramLocation(loc);
  const viewOnDocument = useViewOnDocument();
  const tone = failed ? "border-[#E8A5A5] bg-[#FDF4F4]" : missing ? "border-[#EFD9A6] bg-[#FBF4E4]" : accepted ? "border-[#BFE6CE] bg-[#F3FAF6]" : "border-outline-variant bg-white";

  return (
    <article id={`cr-loc-${loc.location_id}`} className={`scroll-mt-4 rounded-[12px] border ${tone} p-2.5 flex flex-col gap-1.5`} aria-label={t("aria", { id: loc.location_id })}>
      <header className="flex items-start gap-2">
        <p className="flex-1 min-w-0 text-body font-bold text-on-surface">
          {diagram ? diagramLocationTitle(loc, tDiagram) : locTitle(loc)}
          <span className="block text-caption font-medium text-on-surface-muted">{sectionTitle(loc.section_id, loc.section_title)}</span>
          {viewOnDocument && loc.conclusion === "edit" && !diagram && <ViewOnDocumentLink locationId={loc.location_id} onView={viewOnDocument} />}
        </p>
        {failed ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#B03030] text-white text-caption font-bold">{t("failed")}</span>
        ) : missing ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#8A6D1F] text-white text-caption font-bold">{t("missing")}</span>
        ) : accepted ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#1F7A45] text-white text-caption font-bold">{t("accepted")}</span>
        ) : (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary-soft text-primary-hover text-caption font-bold">{t("waiting")}</span>
        )}
      </header>

      {missing && <p className="text-[#8A6D1F]">{t("missingHint")}</p>}
      {loc.conclusion === "edit" && p && (diagram ? <OriginalDiagramChange loc={loc} /> : <ProposalDiff loc={loc} />)}
      <OthersPending loc={loc} />
      {loc.conclusion === "comment" && p?.comment_text && <p className="text-[#3B4FA8] bg-[#EEF1FB] rounded-[8px] px-2.5 py-1.5">💬 {humanizeText(p.comment_text)}</p>}
      {loc.reason && !missing && !diagram && <p className="text-on-surface-muted">{t("reason", { reason: humanizeText(loc.reason) })}</p>}
      <AssumptionsNote assumptions={p?.assumptions} />

      {warned && loc.warning && (
        // C-4: AI cảnh báo yêu cầu ở chỗ này - chưa chọn "Vẫn làm" hay bỏ thì chưa gửi duyệt được
        <div className="rounded-[8px] bg-[#FBF4E4] px-2.5 py-1.5 text-[#8A6D1F]" aria-label={t("warningAria")}>
          <p className="font-bold">{t("warningTitle")}</p>
          <p>{humanizeText(loc.warning.reason)}</p>
          <p className="text-caption mt-0.5">{t("proceedHint")}</p>
        </div>
      )}
      {(loc.kept_violations?.length ?? 0) > 0 && <p className="text-[#8A6D1F]">{t("keptNote")}</p>}

      {failed && (
        // FLF-375: không in thông báo luật nội bộ (op_not_allowed, path…) — AI nói bằng lời chỗ nào chưa sửa được
        <div className="rounded-[8px] bg-white border border-[#F2CACA] px-2.5 py-1.5" aria-label={t("failedAria")}>
          <p className="text-[#8A4141]">{loc.verify!.violations.some((v) => v.rule === "value_changed") ? t("askChanged") : t("askFailed")}</p>
        </div>
      )}
      {!failed && (loc.verify?.ai_flags.length ?? 0) > 0 && (
        <div className="rounded-[8px] bg-[#FBF4E4] px-2.5 py-1.5 text-[#8A6D1F]" aria-label={t("aiFlagsAria")}>
          <p className="font-bold">{t("aiFlagsTitle")}</p>
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
          {keepable && (
            // C-5: chỉ lỗi luật (cờ đỏ mới) - lỗi "chữ cũ không còn khớp" không có lựa chọn này
            <div className="flex flex-col gap-1">
              <div>
                <button type="button" disabled={busy} onClick={() => chat.keep(loc)} className={`${btn} border border-outline-variant bg-white text-on-surface`}>
                  {t("keep")}
                </button>
              </div>
              <p className="text-caption text-on-surface-muted">{t("keepHint")}</p>
            </div>
          )}
          <div>
            <button type="button" disabled={busy} onClick={() => chat.reject(loc)} className={`${btn} text-[#B03030] px-0`}>
              {missing ? t("skipMissing") : t("dropThis")}
            </button>
          </div>
        </>
      ) : !accepted && !missing ? (
        <div className="flex flex-wrap gap-1.5">
          {warned ? (
            <button type="button" disabled={busy || !chat.canRedraft} onClick={() => chat.proceed(loc)} className={`${btn} bg-on-surface text-surface`}>
              {t("proceed")}
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => chat.accept(loc)} className={`${btn} bg-[#1F7A45] text-white`}>
              {t("accept")}
            </button>
          )}
          {chat.canRedraft && !diagram && (
            <button type="button" disabled={busy} onClick={openEdit} className={`${btn} border border-outline-variant bg-white text-on-surface`}>
              {t("redo")}
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => chat.reject(loc)} className={`${btn} border border-[#F2CACA] bg-white text-[#B03030]`}>
            {diagram ? t("keepDiagram") : t("reject")}
          </button>
        </div>
      ) : null}
    </article>
  );
}

/**
 * FLF-318: CR mang lô đã duyệt ở bản xem trước — như trước baseline, không bắt duyệt lại từng phần: một khung tóm tắt, mỗi
 * phần mở ra xem được thay đổi. Phần trượt kiểm (nếu có) vẫn hiện thẻ riêng để sửa / bỏ.
 */
function ApprovedBatch({ locations, failing, chat }: { locations: CrLocation[]; failing: CrLocation[]; chat: CrChat }) {
  const t = useTranslations("mode1.crThread.approved");
  const tDiagram = useTranslations("mode1.originalDiagram");
  const { sectionTitle } = useMode1Labels();
  const locTitle = useLocTitle();
  return (
    <AiBubble step={t("step", { count: locations.length })} label={t("label")}>
      <p className="text-on-surface-muted">{t("intro")}</p>
      <ul className="flex flex-col gap-1">
        {locations.map((l) => (
          <li key={l.location_id}>
            <details>
              <summary className="cursor-pointer">
                <strong className="text-on-surface">{isDiagramLocation(l) ? diagramLocationTitle(l, tDiagram) : locTitle(l)}</strong>
                <span className="text-on-surface-muted"> - {sectionTitle(l.section_id, l.section_title)}</span>
              </summary>
              <div className="mt-1.5">
                {l.proposal && (isDiagramLocation(l) ? <OriginalDiagramChange loc={l} /> : <ProposalDiff loc={l} />)}
                <AssumptionsNote assumptions={l.proposal?.assumptions} />
              </div>
            </details>
          </li>
        ))}
      </ul>
      {failing.length > 0 && (
        <div className="flex flex-col gap-2">
          {failing.map((l) => (
            <LocationCard key={l.location_id} loc={l} chat={chat} />
          ))}
        </div>
      )}
    </AiBubble>
  );
}

/**
 * FLF-375: phần phải quyết riêng (thẻ có nút riêng, "Đồng ý tất cả" không duyệt luôn) — trượt kiểm, AI chưa đề xuất, thay
 * sơ đồ gốc (§4.13), hoặc có lưu ý của AI.
 */
export const needsOwnCard = (l: CrLocation): boolean => isFailing(l) || l.conclusion === null || isDiagramLocation(l) || (l.verify?.ai_flags.length ?? 0) > 0 || !!l.conflict || isWarningPending(l) || (l.kept_violations?.length ?? 0) > 0;

const SHORT = 40;
const short = (s: string): string => (s.length > SHORT ? `${s.slice(0, SHORT - 1)}…` : s);

/**
 * Một dòng trong danh sách gom (FLF-495): mục + tên ngắn + trạng thái + Đồng ý / Bỏ. Chỗ đổi xem trên tài liệu (nút "Xem trên tài
 * liệu"), không in diff chữ trong chat; bấm ▸ mở chi tiết (diff, lý do, giả định) kèm Sửa lại.
 */
function BatchRow({ loc, chat }: { loc: CrLocation; chat: CrChat }) {
  const t = useTranslations("mode1.crThread.batch");
  const tLoc = useTranslations("mode1.crThread.loc");
  const { sectionTitle, humanizeText } = useMode1Labels();
  const locTitle = useLocTitle();
  const viewOnDocument = useViewOnDocument();
  const editing = chat.redraftFor === loc.location_id;
  const [open, setOpen] = useState(false);
  const expanded = open || editing;
  const p = loc.proposal;
  const accepted = chat.isAccepted(loc);
  const busy = chat.busy !== null;
  const title = locTitle(loc);

  return (
    <li id={`cr-loc-${loc.location_id}`} className={`scroll-mt-4 rounded-[10px] border ${accepted ? "border-[#BFE6CE] bg-[#F3FAF6]" : "border-outline-variant bg-white"} px-2.5 py-1.5`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-body truncate" title={`${sectionTitle(loc.section_id, loc.section_title)} - ${title}`}>
            <strong className="text-on-surface">{sectionTitle(loc.section_id, loc.section_title)}</strong>
            <span className="text-on-surface-muted"> - {title}</span>
          </p>
          {loc.conclusion === "comment" && p?.comment_text && <p className="text-caption text-[#3B4FA8] truncate">💬 {short(humanizeText(p.comment_text))}</p>}
        </div>
        {viewOnDocument && loc.conclusion === "edit" && (
          <button type="button" onClick={() => viewOnDocument(loc.location_id)} className="shrink-0 text-caption font-bold text-primary hover:underline cursor-pointer whitespace-nowrap">
            {tLoc("viewOnDocument")}
          </button>
        )}
        {accepted ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-caption font-bold bg-[#1F7A45] text-white">{tLoc("accepted")}</span>
        ) : editing ? null : (
          <>
            <button type="button" disabled={busy} onClick={() => chat.accept(loc)} aria-label={t("acceptRow", { title })} className={`${btn} px-2.5 py-0.5 bg-[#1F7A45] text-white`}>
              {tLoc("accept")}
            </button>
            <button type="button" disabled={busy} onClick={() => chat.reject(loc)} aria-label={t("rejectRow", { title })} className={`${btn} px-2.5 py-0.5 border border-[#F2CACA] bg-white text-[#B03030]`}>
              {tLoc("reject")}
            </button>
          </>
        )}
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? t("collapse", { title }) : t("expand", { title })}
          onClick={() => {
            if (editing) chat.cancelRedraft();
            setOpen(!expanded);
          }}
          className="shrink-0 w-6 h-6 grid place-items-center rounded-[6px] hover:bg-surface-container text-on-surface-muted cursor-pointer"
        >
          {expanded ? "▾" : "▸"}
        </button>
      </div>
      {expanded && (
        <div className="mt-1.5 flex flex-col gap-1.5" aria-label={t("detailAria", { id: loc.location_id })}>
          {loc.conclusion === "edit" && p && <ProposalDiff loc={loc} />}
          <OthersPending loc={loc} />
          {loc.conclusion === "comment" && p?.comment_text && <p className="text-[#3B4FA8] bg-[#EEF1FB] rounded-[8px] px-2.5 py-1.5">💬 {humanizeText(p.comment_text)}</p>}
          {loc.reason && <p className="text-on-surface-muted">{tLoc("reason", { reason: humanizeText(loc.reason) })}</p>}
          <AssumptionsNote assumptions={p?.assumptions} />
          {editing ? (
            <EditPanel loc={loc} chat={chat} editing />
          ) : (
            chat.canRedraft && (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" disabled={busy} onClick={() => chat.startRedraft(loc.location_id)} className={`${btn} border border-outline-variant bg-white text-on-surface`}>
                  {tLoc("redo")}
                </button>
              </div>
            )
          )}
        </div>
      )}
    </li>
  );
}

/**
 * FLF-375: bước đề xuất gom một khung — các phần đã đạt kiểm thành danh sách gọn + **Đồng ý tất cả**; phần phải quyết
 * riêng (`needsOwnCard`) giữ thẻ có nút riêng như cũ.
 */
function ProposalBatch({ projectId, locations, chat }: { projectId: string; locations: CrLocation[]; chat: CrChat }) {
  const t = useTranslations("mode1.crThread.batch");
  const rows = locations.filter((l) => !needsOwnCard(l));
  // Hình gốc sẽ bị thay (đề xuất của code, kiểm đạt) ⇒ một khối có ảnh trước / sau thay cho mỗi hình một thẻ chữ
  const diagrams = locations.filter((l) => isDiagramLocation(l) && l.conclusion === "edit" && !!l.proposal && !isFailing(l));
  const own = locations.filter((l) => needsOwnCard(l) && !diagrams.includes(l));
  const pending = rows.filter((l) => !chat.isAccepted(l));
  const viewOnDocument = useViewOnDocument();
  return (
    <div className="flex flex-col gap-2">
      {viewOnDocument && (rows.length > 0 || own.length > 0) && (
        <div>
          <button type="button" onClick={() => viewOnDocument(null)} className={`${btn} border border-outline-variant bg-white text-on-surface`}>
            {t("viewAllOnDocument")}
          </button>
        </div>
      )}
      {/* FLF-375 (spec 04): việc cần bạn quyết lên đầu; phần đã đạt kiểm thu gọn bên dưới */}
      <OriginalDiagramGroup projectId={projectId} locations={diagrams} chat={chat} />
      {own.length > 0 && (
        <section className="flex flex-col gap-2" aria-label={t("ownAria")}>
          <p className="font-bold text-[#8A6D1F]">{t("ownTitle", { count: own.length })}</p>
          {own.map((l) => (
            <LocationCard key={l.location_id} loc={l} chat={chat} />
          ))}
        </section>
      )}
      {rows.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label={t("listAria")}>
          {rows.map((l) => (
            <BatchRow key={l.location_id} loc={l} chat={chat} />
          ))}
        </ul>
      )}
      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={chat.busy !== null} onClick={() => chat.acceptMany(pending)} className={`${btn} bg-[#1F7A45] text-white`}>
            {t("acceptAll", { count: pending.length })}
          </button>
          <span className="text-caption text-on-surface-muted">{t("perRowHint")}</span>
        </div>
      )}
    </div>
  );
}

/** Phần không sửa (AI thấy không liên quan / bạn đã bỏ) — thu gọn, đưa lại được. */
function DroppedList({ locations, chat }: { locations: CrLocation[]; chat: CrChat }) {
  const t = useTranslations("mode1.crThread.dropped");
  const tDiagram = useTranslations("mode1.originalDiagram");
  const { humanizeText } = useMode1Labels();
  const locTitle = useLocTitle();
  if (!locations.length) return null;
  return (
    <details className="text-body text-on-surface-muted">
      <summary className="cursor-pointer font-semibold">{t("summary", { count: locations.length })}</summary>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {locations.map((l) => (
          <li key={l.location_id} className="flex flex-col gap-1">
            <span>
              <strong className="text-on-surface">{isDiagramLocation(l) ? diagramLocationTitle(l, tDiagram) : locTitle(l)}</strong>
              {l.reason ? ` - ${humanizeText(l.reason)}` : ""}
            </span>
            {isDiagramLocation(l) ? (
              // BE tính lại ngay (không AI): dữ liệu hình thể hiện đã đổi thì đề xuất thay hình quay lại
              chat.canRedraft && (
                <button type="button" disabled={chat.busy !== null} onClick={() => void chat.redraft(l.location_id, "Tính lại đề xuất vẽ lại hình gốc")} className="self-start underline">
                  {t("recheckDiagram")}
                </button>
              )
            ) : chat.redraftFor === l.location_id ? (
              <RedraftBox loc={l} chat={chat} onClose={chat.cancelRedraft} />
            ) : (
              chat.canRedraft && (
                <button type="button" disabled={chat.busy !== null} onClick={() => chat.startRedraft(l.location_id)} className="self-start underline">
                  {t("bringBack")}
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
/**
 * BF §3.2: đề xuất chưa xác nhận **treo ở người yêu cầu** — người khác mở CR này chỉ thấy "đang treo ở X", không có nút
 * xác nhận (họ không có bối cảnh, người xác nhận đứng tên thay đổi).
 */
function ReadyToSubmit({ c, locations, chat, myUserId }: { c: CrDetail["change_request"]; locations: CrLocation[]; chat: CrChat; myUserId: string | null }) {
  const t = useTranslations("mode1.crThread");
  const removed = removedOfAll(locations);
  const notMine = myUserId !== null && c.created_by !== myUserId;
  return (
    <AiBubble step={t("readyStep")} label={t("readyLabel")}>
      {notMine ? (
        <p className="text-[#8A6D1F]">{t("notRequester", { who: c.created_by_name ?? c.requester })}</p>
      ) : (
        <>
          <p>{t("readyText")}</p>
          {removed.length > 0 && (
            <p role="note" className="rounded-[8px] bg-accent-gold-soft px-3 py-2 text-body text-on-surface">
              {t("removesContent", { items: removed.slice(0, 5).join("; ") })}
              {removed.length > 5 ? ` ${t("removesContentMore", { count: removed.length - 5 })}` : ""}
            </p>
          )}
          <div className="flex gap-1.5">
            <button type="button" disabled={chat.busy !== null} onClick={chat.submit} className={`${btn} btn-gradient-primary text-white`}>
              {t("submit")}
            </button>
          </div>
          <p className="text-on-surface-muted text-body">{t("readyMore", { crId: c.cr_id })}</p>
        </>
      )}
    </AiBubble>
  );
}

export default function Mode1CrThread({ projectId, chat, me, myUserId = null }: { projectId: string; chat: CrChat; me: string; myUserId?: string | null }) {
  const t = useTranslations("mode1.crThread");
  const { sectionTitle } = useMode1Labels();
  const locTitle = useLocTitle();
  const d = chat.detail;
  const busy = chat.busy !== null;

  const errorBox = chat.error && (
    <div role="alert" className="bg-error-container text-error rounded-control px-3 py-2 text-body flex items-start gap-2">
      <span className="flex-1 flex flex-col gap-1.5 items-start">
        {chat.error}
        {chat.ownOpen && (
          // CR_OWN_OPEN: mỗi người một CR mở - mở lại CR đang dở thay vì tạo mới
          <button type="button" disabled={busy} onClick={() => void chat.openOwn()} className={`${btn} bg-on-surface text-surface`}>
            {chat.ownOpen.crId ? t("openOwn", { crId: chat.ownOpen.crId }) : t("openOwnAny")}
          </button>
        )}
      </span>
      <button type="button" onClick={chat.clearError} aria-label={t("errorClose")} className="font-bold">
        ✕
      </button>
    </div>
  );
  // Lô đã duyệt ở bản xem trước: các bước chỉ chia lô về vị trí + kiểm, không có AI soạn
  const quiet = d !== null && fromApprovedPreview(d) && (chat.busy === "clarify" || chat.busy === "impact" || chat.busy === "propose" || chat.busy === "verify");
  const busyLine = chat.busy && (
    <p className="self-start text-body text-on-surface-muted italic" role="status">
      {quiet ? t("approved.busy") : t(`busy.${chat.busy}`)}
    </p>
  );

  if (!d) {
    return (
      <div className="flex flex-col gap-3" aria-label={t("rootAria")}>
        {chat.sent && (
          <AiBubble step={t("sentStep")} label={t("sentLabel")}>
            <p>
              {t.rich("sentText", {
                crId: chat.sent,
                strong: (c) => <strong>{c}</strong>,
                link: (c) => (
                  <Link href={`/projects/${projectId}/change-requests/${chat.sent}`} className="underline font-semibold">
                    {c}
                  </Link>
                ),
              })}
            </p>
            <p className="text-on-surface-muted">{t("sentNext")}</p>
            <div className="flex flex-col gap-1">
              <div>
                <button type="button" disabled={busy || !me} onClick={() => void chat.revert(chat.sent!, me)} className={`${btn} border border-outline-variant bg-white text-on-surface`}>
                  {t("revert")}
                </button>
              </div>
              <p className="text-caption text-on-surface-muted">{t("revertHint")}</p>
            </div>
          </AiBubble>
        )}
        {!chat.sent && !chat.pending && !chat.loading && (
          <AiBubble label={t("guideLabel")}>
            <p>{t.rich("guide", { em: (c) => <em>{c}</em> })}</p>
          </AiBubble>
        )}
        {chat.pending && (
          <>
            <UserBubble>{chat.pending}</UserBubble>
            {chat.pendingFromPreview && (
              <AiBubble label={t("fromPreviewLabel")}>
                <p>{t("fromPreview")}</p>
              </AiBubble>
            )}
            <RequesterCard me={me} busy={busy} onStart={(s) => void chat.startCr(s)} onCancel={chat.cancelPending} prefill={chat.prefill} />
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
  const conflicts = d.locations.filter((l) => !!l.conflict);
  const jump = (locId: string) => document.getElementById(`cr-loc-${locId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  const materialsEditable = (c.status === "draft" || c.status === "awaiting_answers") && !c.paused;
  const approved = fromApprovedPreview(d);

  return (
    <div className="flex flex-col gap-3" aria-label={t("crAria", { crId: c.cr_id })}>
      <div className="flex items-center gap-2 text-body text-on-surface-muted">
        <span className="font-bold text-primary-hover">{c.cr_id}</span>
        <span className="truncate">· {c.requester}</span>
        <Link href={`/projects/${projectId}/change-requests/${c.cr_id}`} className="ml-auto underline shrink-0">
          {t("openCr")}
        </Link>
      </div>
      <CrTimeline status={c.status} compact />

      <UserBubble>{c.description}</UserBubble>
      {c.amendments.map((a, i) => (
        <UserBubble key={i}>{a.text}</UserBubble>
      ))}

      {(c.clarifications.length > 0 || d.pending_questions.length > 0) && (
        <AiBubble step={t("clarifyStep")} label={t("clarifyLabel")}>
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
      {chat.withdrawAsk && (c.status === "awaiting_answers" || chat.withdrawAfterAnswer) && (
        <WithdrawCard
          crId={c.cr_id}
          answers={chat.withdrawAsk}
          busy={busy}
          onCancelCr={chat.confirmWithdraw}
          onAnswer={chat.answerAnyway}
          onDismiss={chat.dismissWithdraw}
        />
      )}
      {c.materials.length > 0 && (
        <MaterialList
          items={c.materials.map((m) => ({ key: m.material_id, name: m.name, kind: m.kind, text: m.text, truncated: m.truncated, round: m.round }))}
          onRemove={materialsEditable ? (id) => void chat.removeMaterial(id) : undefined}
          busy={chat.busy === "material"}
        />
      )}
      {c.missing_info.length > 0 && (
        <AiBubble label={t("missingInfoLabel")}>
          <p className="text-[#8A6D1F] font-semibold">{t("missingInfoTitle")}</p>
          <ul className="list-disc pl-5 text-[#8A6D1F]">
            {c.missing_info.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </AiBubble>
      )}

      {approved && proposed && (
        <ApprovedBatch locations={toReview.filter((l) => inApprovedBatch(d, l))} failing={toReview.filter((l) => l.found_by.includes("preview") && isFailing(l))} chat={chat} />
      )}
      {/* FLF-375: chỗ ngoài lô đã duyệt (AI đề xuất thêm, sơ đồ gốc vẽ lại) ⇒ người dùng quyết như mọi CR */}
      {approved && proposed && toReview.some((l) => !l.found_by.includes("preview")) && (
        <AiBubble step={t("proposeStep", { settled, total: toReview.length })} label={t("proposeLabel")} flat>
          <p className="text-on-surface-muted">{t("proposeHint")}</p>
          <ProposalBatch projectId={projectId} locations={toReview.filter((l) => !l.found_by.includes("preview"))} chat={chat} />
          <DroppedList locations={dropped} chat={chat} />
        </AiBubble>
      )}

      {/* Đã có đề xuất: danh sách phần liên quan chỉ lặp lại danh sách đề xuất bên dưới ⇒ thu về một dòng, bấm mới mở */}
      {!approved && d.locations.length > 0 && proposed && toReview.length > 0 && (
        <CollapsedImpact label={t("impactLabel")} step={t("impactStep", { count: d.locations.length })}>
          <ul className="list-disc pl-5">
            {d.locations.map((l) => (
              <li key={l.location_id}>
                {sectionTitle(l.section_id, l.section_title)} - {locTitle(l)}
              </li>
            ))}
          </ul>
        </CollapsedImpact>
      )}

      {!approved && d.locations.length > 0 && !(proposed && toReview.length > 0) && (
        <AiBubble step={t("impactStep", { count: d.locations.length })} label={t("impactLabel")} flat>
          <ul className="list-disc pl-5">
            {d.locations.map((l) => (
              <li key={l.location_id}>
                {sectionTitle(l.section_id, l.section_title)} - {locTitle(l)}
              </li>
            ))}
          </ul>
          {c.status === "impact_review" && !c.paused && d.propose_estimate && (
            <p className="text-[#8A6D1F]">{t("estimate", { locations: d.propose_estimate.locations, batches: d.propose_estimate.batches, credits: d.propose_estimate.credits })}</p>
          )}
          {c.status === "impact_review" && !c.paused && (
            <div>
              <button type="button" disabled={busy} onClick={chat.proposeNow} className={`${btn} bg-on-surface text-surface`}>
                {t("proposeNow")}
              </button>
            </div>
          )}
        </AiBubble>
      )}

      {!approved && proposed && (toReview.length > 0 || dropped.length > 0) && (
        <AiBubble step={t("proposeStep", { settled, total: toReview.length })} label={t("proposeLabel")} flat>
          {toReview.length > 0 ? (
            <p className="text-on-surface-muted">{t("proposeHint")}</p>
          ) : (
            <p className="text-on-surface-muted">{t("proposeNone")}</p>
          )}
          <ProposalBatch projectId={projectId} locations={toReview} chat={chat} />
          <DroppedList locations={dropped} chat={chat} />
        </AiBubble>
      )}

      {conflicts.length > 0 && (
        <AiBubble step={t("conflictStep")} label={t("conflictLabel")}>
          <p>{t("conflictIntro", { count: conflicts.length })}</p>
          {conflicts.map((l) => (
            <ConflictCard key={l.location_id} loc={l} chat={chat} request={c.description} />
          ))}
        </AiBubble>
      )}
      {c.status === "manual_fix" && !c.paused && conflicts.length === 0 && (
        <AiBubble step={t("manualStep")} label={t("manualLabel")}>
          {blockers.length > 0 ? (
            <>
              <p>{t.rich("manualBlockers", { count: blockers.length, strong: (c) => <strong>{c}</strong> })}</p>
              <ul className="flex flex-col gap-1">
                {blockers.map((l) => (
                  <li key={l.location_id}>
                    <button type="button" onClick={() => jump(l.location_id)} className="text-left underline text-[#B03030] font-semibold">
                      {sectionTitle(l.section_id, l.section_title)} - {locTitle(l)}
                    </button>
                    <span className="text-on-surface-muted"> - {l.conclusion === null ? t("blockerMissing") : t("blockerFailed")}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>{t("manualCleared")}</p>
          )}
          <div>
            <button type="button" disabled={busy} onClick={chat.verifyNow} className={`${btn} bg-on-surface text-surface`}>
              {chat.busy === "verify" ? t("verifying") : t("verifyNow")}
            </button>
          </div>
        </AiBubble>
      )}
      {c.status === "ready_to_submit" && <ReadyToSubmit c={c} locations={d.locations} chat={chat} myUserId={myUserId} />}

      {chat.replies.map((r, i) => (
        <div key={i} className="flex flex-col gap-2">
          <UserBubble>{r.question}</UserBubble>
          <AiBubble label={t("replyLabel")}>
            <p className="whitespace-pre-wrap">{r.reply}</p>
          </AiBubble>
        </div>
      ))}
      {c.paused && <PausedBanner paused={c.paused} what={t("pausedWhat")} busy={chat.busy === "resume"} onResume={chat.resume} />}
      {!busy && !c.paused && c.status !== "manual_fix" && chat.canContinue && (
        <div>
          <button type="button" onClick={chat.continueFlow} className={`${btn} border border-outline-variant bg-white text-on-surface`}>
            {t("continue")}
          </button>
        </div>
      )}
      {busyLine}
      {errorBox}
    </div>
  );
}
