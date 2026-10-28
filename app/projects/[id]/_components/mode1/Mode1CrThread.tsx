"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CR_MAX_MATERIALS, NEW_CR_SOURCE_KINDS, type CrLocation, type CrStatus } from "@/types/change-request";
import { fromApprovedPreview, isFailing, type CrChat, type CrChatSource } from "../../hooks/mode1/useCrChat";
import ClarifyPanel from "./ClarifyPanel";
import { AssumptionsNote, MaterialAdder, MaterialList } from "./CrMaterials";
import FieldChanges from "./FieldChanges";
import OriginalDiagramChange, { diagramLocationTitle, isDiagramLocation } from "./OriginalDiagramChange";
import { useMode1Labels } from "./i18n";
import PausedBanner from "./PausedBanner";
import ValueEditor from "./ValueEditor";

function UserBubble({ children }: { children: ReactNode }) {
  return <div className="self-end max-w-[85%] bg-primary-soft text-on-surface rounded-[14px] rounded-br-[4px] px-3 py-2 text-body whitespace-pre-wrap">{children}</div>;
}

function AiBubble({ step, children, label }: { step?: string; children: ReactNode; label?: string }) {
  return (
    <div className="self-start w-full bg-surface-container-lowest border border-outline-variant rounded-[14px] rounded-bl-[4px] px-3 py-2.5 text-body text-on-surface flex flex-col gap-2" aria-label={label}>
      {step && <p className="text-caption font-bold uppercase tracking-wider text-primary-hover">{step}</p>}
      {children}
    </div>
  );
}

const btn = "px-3 py-1 rounded-[8px] text-body font-bold disabled:opacity-50 cursor-pointer";

/** 3.1 trong chat: chọn nguồn + người yêu cầu cho lệnh sửa đầu tiên. */
function RequesterCard({ me, busy, onStart, onCancel }: { me: string; busy: boolean; onStart: (s: CrChatSource) => void; onCancel: () => void }) {
  const t = useTranslations("mode1.crThread.requester");
  const { crSource } = useMode1Labels();
  const [other, setOther] = useState(false);
  const [kind, setKind] = useState<CrChatSource["kind"]>("stakeholder_email");
  const [requester, setRequester] = useState("");
  const [ref, setRef] = useState("");
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

/** Thanh tiến độ 5 bước của change request trong chat — bước đang ở tô đậm, bước đã qua có dấu ✓. */
const STEPS = ["clarify", "impact", "propose", "verify", "submit"] as const;
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
  const t = useTranslations("mode1.crThread.steps");
  const current = stepIndex(status);
  return (
    <ol className="flex items-center gap-1 text-caption font-bold" aria-label={t("aria")}>
      {STEPS.map((step, i) => (
        <li key={step} className="flex items-center gap-1 min-w-0" aria-current={i === current ? "step" : undefined}>
          <span
            className={`shrink-0 w-4 h-4 grid place-items-center rounded-full text-caption ${
              i < current ? "bg-[#1F7A45] text-white" : i === current ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-muted"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </span>
          <span className={`truncate ${i === current ? "text-on-surface" : "text-on-surface-muted"}`}>{t(step)}</span>
          {i < STEPS.length - 1 && <span aria-hidden className="w-2 h-px bg-outline-variant shrink-0" />}
        </li>
      ))}
    </ol>
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
 * Chỗ sửa một phần (3.9): hai cách — **Nhờ AI soạn lại** (gõ hướng sửa) hoặc **Tự sửa** (sửa thẳng nội dung theo từng trường
 * / đoạn). Bản tự sửa tính luôn là đã đồng ý.
 */
function EditPanel({ loc, chat, editing }: { loc: CrLocation; chat: CrChat; editing: boolean }) {
  const t = useTranslations("mode1.crThread.edit");
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const oldText = loc.proposal?.old_text ?? loc.current_text;
  const tab = (value: "ai" | "manual", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => setMode(value)}
      className={`px-2.5 py-1 rounded-[8px] text-body font-bold ${mode === value ? "bg-on-surface text-surface" : "text-on-surface-muted hover:bg-surface-container"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] bg-surface-container-lowest border border-outline-variant p-2">
      <div role="tablist" aria-label={t("tablistAria", { id: loc.location_id })} className="flex gap-1">
        {tab("ai", t("tabAi"))}
        {tab("manual", t("tabManual"))}
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
  const t = useTranslations("mode1.crThread.loc");
  const tDiagram = useTranslations("mode1.originalDiagram");
  const { pathLabel, sectionTitle, humanizeText } = useMode1Labels();
  const p = loc.proposal;
  const failed = isFailing(loc);
  const missing = loc.conclusion === null;
  const accepted = !failed && !missing && chat.isAccepted(loc);
  const busy = chat.busy !== null;
  const editing = chat.redraftFor === loc.location_id;
  const openEdit = () => chat.startRedraft(loc.location_id);
  // Sơ đồ gốc (§4.13): BE tự đề xuất, không có gì để AI soạn lại — chỉ Đồng ý (thay hình) hoặc Giữ hình gốc
  const diagram = isDiagramLocation(loc);
  const tone = failed ? "border-[#E8A5A5] bg-[#FDF4F4]" : missing ? "border-[#EFD9A6] bg-[#FBF4E4]" : accepted ? "border-[#BFE6CE] bg-[#F3FAF6]" : "border-outline-variant bg-white";

  return (
    <article id={`cr-loc-${loc.location_id}`} className={`scroll-mt-4 rounded-[12px] border ${tone} p-2.5 flex flex-col gap-1.5`} aria-label={t("aria", { id: loc.location_id })}>
      <header className="flex items-start gap-2">
        <p className="flex-1 min-w-0 text-body font-bold text-on-surface" title={loc.path}>
          {diagram ? diagramLocationTitle(loc, tDiagram) : pathLabel(loc.path)}
          <span className="block text-caption font-medium text-on-surface-muted">{sectionTitle(loc.section_id, loc.section_title)}</span>
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
      {loc.conclusion === "edit" && p && (diagram ? <OriginalDiagramChange loc={loc} /> : <FieldChanges oldText={p.old_text} newText={p.new_text} />)}
      {loc.conclusion === "comment" && p?.comment_text && <p className="text-[#3B4FA8] bg-[#EEF1FB] rounded-[8px] px-2.5 py-1.5">💬 {humanizeText(p.comment_text)}</p>}
      {loc.reason && !missing && !diagram && <p className="text-on-surface-muted">{t("reason", { reason: humanizeText(loc.reason) })}</p>}
      <AssumptionsNote assumptions={p?.assumptions} />

      {failed && (
        <div className="rounded-[8px] bg-white border border-[#F2CACA] px-2.5 py-1.5" aria-label={t("failedAria")}>
          <p className="font-bold text-[#B03030]">{t("failedTitle")}</p>
          <ul className="list-disc pl-5 text-[#8A4141]">
            {loc.verify!.violations.map((v, i) => (
              <li key={i}>{humanizeText(v.message)}</li>
            ))}
          </ul>
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
          <div>
            <button type="button" disabled={busy} onClick={() => chat.reject(loc)} className={`${btn} text-[#B03030] px-0`}>
              {missing ? t("skipMissing") : t("dropThis")}
            </button>
          </div>
        </>
      ) : !accepted && !missing ? (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" disabled={busy} onClick={() => chat.accept(loc)} className={`${btn} bg-[#1F7A45] text-white`}>
            {t("accept")}
          </button>
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
  const { pathLabel, sectionTitle } = useMode1Labels();
  return (
    <AiBubble step={t("step", { count: locations.length })} label={t("label")}>
      <p className="text-on-surface-muted">{t("intro")}</p>
      <ul className="flex flex-col gap-1">
        {locations.map((l) => (
          <li key={l.location_id}>
            <details>
              <summary className="cursor-pointer">
                <strong className="text-on-surface">{isDiagramLocation(l) ? diagramLocationTitle(l, tDiagram) : pathLabel(l.path)}</strong>
                <span className="text-on-surface-muted"> — {sectionTitle(l.section_id, l.section_title)}</span>
              </summary>
              <div className="mt-1.5">
                {l.proposal && (isDiagramLocation(l) ? <OriginalDiagramChange loc={l} /> : <FieldChanges oldText={l.proposal.old_text} newText={l.proposal.new_text} />)}
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

/** Phần không sửa (AI thấy không liên quan / bạn đã bỏ) — thu gọn, đưa lại được. */
function DroppedList({ locations, chat }: { locations: CrLocation[]; chat: CrChat }) {
  const t = useTranslations("mode1.crThread.dropped");
  const tDiagram = useTranslations("mode1.originalDiagram");
  const { pathLabel, humanizeText } = useMode1Labels();
  if (!locations.length) return null;
  return (
    <details className="text-body text-on-surface-muted">
      <summary className="cursor-pointer font-semibold">{t("summary", { count: locations.length })}</summary>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {locations.map((l) => (
          <li key={l.location_id} className="flex flex-col gap-1">
            <span>
              <strong className="text-on-surface">{isDiagramLocation(l) ? diagramLocationTitle(l, tDiagram) : pathLabel(l.path)}</strong>
              {l.reason ? ` — ${humanizeText(l.reason)}` : ""}
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
export default function Mode1CrThread({ projectId, chat, me }: { projectId: string; chat: CrChat; me: string }) {
  const t = useTranslations("mode1.crThread");
  const { pathLabel, sectionTitle, humanizeText, crStatus } = useMode1Labels();
  const d = chat.detail;
  const busy = chat.busy !== null;

  const errorBox = chat.error && (
    <div role="alert" className="bg-error-container text-error rounded-control px-3 py-2 text-body flex items-start gap-2">
      <span className="flex-1">{chat.error}</span>
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
  const approved = fromApprovedPreview(d);

  return (
    <div className="flex flex-col gap-3" aria-label={t("crAria", { crId: c.cr_id })}>
      <div className="flex items-center gap-2 text-body text-on-surface-muted">
        <span className="font-bold text-primary-hover">{c.cr_id}</span>
        <span>· {crStatus(c.status)}</span>
        <span className="truncate">· {c.requester}</span>
        <Link href={`/projects/${projectId}/change-requests/${c.cr_id}`} className="ml-auto underline shrink-0">
          {t("openCr")}
        </Link>
      </div>
      <StepTracker status={c.status} />

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

      {approved && proposed && <ApprovedBatch locations={toReview.filter((l) => !isFailing(l))} failing={toReview.filter(isFailing)} chat={chat} />}

      {!approved && d.locations.length > 0 && (
        <AiBubble step={t("impactStep", { count: d.locations.length })} label={t("impactLabel")}>
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
                {t("proposeNow")}
              </button>
            </div>
          )}
        </AiBubble>
      )}

      {!approved && proposed && (toReview.length > 0 || dropped.length > 0) && (
        <AiBubble step={t("proposeStep", { settled, total: toReview.length })} label={t("proposeLabel")}>
          {toReview.length > 0 ? (
            <p className="text-on-surface-muted">{t("proposeHint")}</p>
          ) : (
            <p className="text-on-surface-muted">{t("proposeNone")}</p>
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
        <AiBubble step={t("manualStep")} label={t("manualLabel")}>
          {blockers.length > 0 ? (
            <>
              <p>{t.rich("manualBlockers", { count: blockers.length, strong: (c) => <strong>{c}</strong> })}</p>
              <ul className="flex flex-col gap-1">
                {blockers.map((l) => (
                  <li key={l.location_id}>
                    <button type="button" onClick={() => jump(l.location_id)} className="text-left underline text-[#B03030] font-semibold">
                      {pathLabel(l.path)}
                    </button>
                    <span className="text-on-surface-muted">
                      {" "}
                      — {l.conclusion === null ? t("blockerMissing") : l.verify?.violations[0]?.message ? humanizeText(l.verify.violations[0].message) : t("blockerFailed")}
                    </span>
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
      {c.status === "ready_to_submit" && (
        <AiBubble step={t("readyStep")} label={t("readyLabel")}>
          <p>{t("readyText")}</p>
          <div className="flex gap-1.5">
            <button type="button" disabled={busy} onClick={chat.submit} className={`${btn} btn-gradient-primary text-white`}>
              {t("submit")}
            </button>
          </div>
          <p className="text-on-surface-muted text-body">{t("readyMore", { crId: c.cr_id })}</p>
        </AiBubble>
      )}

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
