"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@/lib/api/client";
import { approveExtraction } from "@/lib/api/extraction";
import { QUESTION_LABELS, type Extraction, type ExtractionDecision, type ExtractionItem, type SituationPoint } from "@/types/extraction";
import { useMode1Labels } from "./i18n";
import { crHref } from "./prefill";
import ExtractionInferenceCard from "./ExtractionInferenceCard";
import { useReferenceViewer } from "../reference-viewer/ReferenceViewerProvider";

interface ExtractionListProps {
  projectId: string;
  extraction: Extraction;
  /** Sau khi duyệt xong (CR đã tạo) — tải lại danh sách CR. */
  onApproved: (extraction: Extraction) => void;
  readOnly?: boolean;
}

interface ItemState {
  include: boolean;
  dropReason: string;
  answer: string;
  group: string;
  /** Mục Suy ra: phương án đang chọn. */
  option: number | null;
}

const LABEL_TONE: Record<ExtractionItem["label"], string> = {
  new: "bg-[#E9F7EE] text-[#1F7A45]",
  modification: "bg-[#F2F1FB] text-[#554DB0]",
  duplicate: "bg-[#F0EEEA] text-[#6B6862]",
  contradiction: "bg-[#FDEDED] text-[#B03030]",
  ambiguous: "bg-[#FBF4E4] text-[#8A6D1F]",
  inferred: "bg-[#EAF3FB] text-[#2D6A9F]",
};

/** `D1-P03` ⇒ 3 (chỉ để in "đoạn 3"); sai khuôn ⇒ null. */
const paragraphNumber = (paraId: string | null | undefined): number | null => {
  const m = paraId ? /^D\d+-P(\d+)$/i.exec(paraId) : null;
  return m ? Number(m[1]) : null;
};

const ELEMENT_PATH = /^([a-z_]+)\[id=(.+)\]$/;

/**
 * Mặc định "đưa vào": mọi mục được tích sẵn (mục Trùng chỉ cần tick), trừ mục Suy ra (BF §3.6.1: không tích sẵn). Mục đã có
 * quyết định giữ nguyên. FLF-449 L7: biểu thức cũ `i.include ?? i.label !== "duplicate" ? … : true` do thứ tự toán tử luôn ra
 * `true` cho mục chưa quyết định.
 */
export const defaultInclude = (item: Pick<ExtractionItem, "include" | "label">): boolean => item.include ?? item.label !== "inferred";

/**
 * Danh sách rút yêu cầu (FLF-338 §3.6.1 bước 1–5): đầu danh sách hiện trạng / mong muốn kèm câu trích; mỗi mục có nhãn gợi ý,
 * trích dẫn + nguồn (tên tài liệu + số đoạn, không mã đoạn), người nói, nhóm; mục Suy ra có thẻ triệu chứng / gốc rễ / hai phương
 * án; mọi câu hỏi (mâu thuẫn / mơ hồ) gom một thẻ kèm gợi ý; BA tick mục đưa vào, bỏ mục nào phải ghi lý do, tách nhóm bằng cách
 * đổi tên nhóm. "Tạo N change request" ⇒ mỗi nhóm một CR; mục Trùng chỉ cần tick (không tạo CR, tài liệu thành nguồn của phần tử).
 */
export default function ExtractionList({ projectId, extraction, onApproved, readOnly = false }: ExtractionListProps) {
  const t = useTranslations("mode1.extraction");
  const L = useMode1Labels();
  const viewer = useReferenceViewer();
  const approved = extraction.status === "approved";
  const editable = !approved && !readOnly;
  const [requester, setRequester] = useState("");
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(extraction.items.map((i) => [i.id, { include: defaultInclude(i), dropReason: i.drop_reason ?? "", answer: i.answer ?? "", group: i.group, option: i.chosen_option ?? null }]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badIds, setBadIds] = useState<Set<string>>(new Set());

  const patch = (id: string, over: Partial<ItemState>) => setState((prev) => ({ ...prev, [id]: { ...prev[id], ...over } }));
  const questions = useMemo(() => extraction.items.filter((i) => QUESTION_LABELS.has(i.label) && i.question), [extraction.items]);

  const included = extraction.items.filter((i) => state[i.id]?.include);
  const crGroups = new Set(included.filter((i) => i.label !== "duplicate").map((i) => state[i.id].group.trim() || i.group));
  const crCount = crGroups.size;
  const problems = extraction.items.filter((i) => {
    const s = state[i.id];
    if (!s.include) return s.dropReason.trim().length === 0;
    if (i.label === "inferred") return s.option === null;
    return QUESTION_LABELS.has(i.label) && s.answer.trim().length === 0;
  });
  const canSubmit = editable && !busy && requester.trim().length > 0 && problems.length === 0 && included.length > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setBadIds(new Set());
    const decisions: ExtractionDecision[] = extraction.items.map((i) => {
      const s = state[i.id];
      const decision: ExtractionDecision = { id: i.id, include: s.include, drop_reason: s.include ? null : s.dropReason.trim(), answer: s.answer.trim() || null, group: s.group.trim() || null };
      return i.label === "inferred" ? { ...decision, chosen_option: s.include ? s.option : null } : decision;
    });
    try {
      const res = await approveExtraction(projectId, extraction.document_id, { requester: requester.trim(), decisions });
      if (res.data) onApproved(res.data);
    } catch (err) {
      setError(L.errorText(err, t("approveFailed")));
      if (err instanceof ApiClientError && Array.isArray(err.meta?.item_ids)) setBadIds(new Set(err.meta.item_ids as string[]));
    } finally {
      setBusy(false);
    }
  };

  /** Nguồn cho người đọc: "minutes.txt · đoạn 2" (AC-B3.11: không in mã đoạn); có trình xem thì bấm để mở đúng đoạn. */
  const source = (paraId: string | null | undefined): ReactNode => {
    const n = paragraphNumber(paraId);
    const label = n ? `${extraction.document_name} · ${t("paragraph", { n })}` : extraction.document_name;
    if (!viewer || !paraId) return label;
    return (
      <button
        type="button"
        onClick={() => viewer.openDocument({ documentId: extraction.document_id, name: extraction.document_name, focusParaId: paraId })}
        aria-label={t("openParagraph", { source: label })}
        className="not-italic underline decoration-dotted cursor-pointer hover:text-[#4B4842]"
      >
        {label}
      </button>
    );
  };

  /** Phần tử chạm tới bằng tên (AC-B3.11): "Use case UC-01 “Đăng nhập”", "Chức năng “Xuất CSV”"; thiếu tên ⇒ nhãn chung. */
  const elementText = (path: string, name: string | undefined): string => {
    const m = ELEMENT_PATH.exec(path);
    if (!m || !name) return L.pathLabel(path);
    return m[1] === "use_cases" ? `${L.entityLabel(m[1])} ${m[2]} “${name}”` : `${L.entityLabel(m[1])} “${name}”`;
  };

  const situation = extraction.situation;
  const situationBlock = (title: string, points: SituationPoint[]) =>
    points.length > 0 && (
      <div className="flex flex-col gap-1">
        <span className="text-caption font-bold text-[#4B4842]">{title}</span>
        <ul className="flex flex-col gap-1">
          {points.map((p, i) => (
            <li key={`${title}-${i}`} className="text-body text-[#191817]">
              {p.text}
              <span className="block text-caption text-[#8A867E] italic">
                “{p.quote}” - {source(p.para_id)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <section className="flex flex-col gap-3" aria-label={t("aria", { name: extraction.document_name })}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-body font-extrabold text-[#191817]">{t("title", { name: extraction.document_name, count: extraction.items.length })}</h3>
        <span className="text-caption text-[#8A867E]">{approved ? t("approvedAt") : t("creditsUsed", { credits: extraction.credits })}</span>
      </div>
      <p className="text-caption text-[#8A867E]">{t("intro")}</p>

      {situation && (situation.current.length > 0 || situation.desired.length > 0) && (
        <div role="group" aria-label={t("situationAria")} className="rounded-[12px] border border-[#ECEAE5] bg-[#F6F5F2] p-3 grid gap-3 sm:grid-cols-2">
          {situationBlock(t("current"), situation.current)}
          {situationBlock(t("desired"), situation.desired)}
        </div>
      )}

      {questions.length > 0 && !approved && (
        <div className="rounded-[12px] border border-[#EFD9A6] bg-[#FBF4E4] p-3 flex flex-col gap-3" role="group" aria-label={t("questionsAria")}>
          <p className="text-body font-bold text-[#8A6D1F]">{t("questionsTitle", { count: questions.length })}</p>
          {questions.map((item) => (
            <div key={item.id} className="flex flex-col gap-1.5">
              <p className="text-body text-[#191817]">
                <span className="font-bold">{item.id}</span> · {item.question}
              </p>
              {item.suggested_answers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.suggested_answers.map((s) => (
                    <button key={s} type="button" onClick={() => patch(item.id, { answer: s })} className={`px-2.5 py-1 rounded-full text-caption font-bold border ${state[item.id].answer === s ? "bg-[#191817] text-white border-[#191817]" : "bg-white border-[#ECEAE5] text-[#4B4842]"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <input
                aria-label={t("answerAria", { id: item.id })}
                value={state[item.id].answer}
                onChange={(e) => patch(item.id, { answer: e.target.value })}
                placeholder={t("answerPlaceholder")}
                className={`w-full px-3 py-1.5 rounded-[8px] bg-white border text-body outline-none ${badIds.has(item.id) ? "border-[#B03030]" : "border-[#ECEAE5]"}`}
              />
            </div>
          ))}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {extraction.items.map((item) => {
          const s = state[item.id];
          const sides = item.sides ?? [];
          return (
            <li key={item.id} className={`bg-white border rounded-[12px] px-3 py-2.5 flex flex-col gap-1.5 ${badIds.has(item.id) ? "border-[#B03030]" : "border-[#ECEAE5]"}`}>
              <div className="flex items-start gap-2">
                {editable ? (
                  <input type="checkbox" aria-label={t("includeAria", { id: item.id })} checked={s.include} onChange={(e) => patch(item.id, { include: e.target.checked })} className="mt-1" />
                ) : (
                  <span className="mt-0.5 text-caption font-bold text-[#8A867E]">{item.include === false ? "✕" : "✓"}</span>
                )}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-caption font-bold text-[#6A62C4]">{item.id}</code>
                    <span className={`px-2 py-0.5 rounded-full text-caption font-bold ${LABEL_TONE[item.label]}`}>{t(`labels.${item.label}`)}</span>
                    <span className="text-caption text-[#8A867E]">{t("group")}</span>
                    {editable && item.label !== "duplicate" ? (
                      <input aria-label={t("groupAria", { id: item.id })} value={s.group} onChange={(e) => patch(item.id, { group: e.target.value })} className="w-16 px-1.5 py-0.5 rounded bg-[#F6F5F2] text-caption font-bold text-[#4B4842] outline-none" />
                    ) : (
                      <span className="text-caption font-bold text-[#4B4842]">{s.group}</span>
                    )}
                    {item.cr_id && (
                      <Link href={crHref(projectId, item.cr_id)} scroll={false} className="ml-auto px-1.5 py-0.5 rounded bg-[#F0EEEA] text-caption font-bold text-[#4B4842] hover:bg-[#E4E1DC]">
                        {item.cr_id}
                      </Link>
                    )}
                  </div>
                  <p className="text-body text-[#191817]">{L.humanizeText(item.text)}</p>
                  {item.speaker && <p className="text-caption text-[#4B4842]">{t("speaker", { name: item.speaker })}</p>}
                  {item.label === "inferred" && item.inference ? (
                    <ExtractionInferenceCard
                      itemId={item.id}
                      inference={item.inference}
                      chosen={approved ? (item.chosen_option ?? null) : s.option}
                      readOnly={!editable}
                      onChoose={(index) => patch(item.id, { option: index, include: true })}
                      source={source(item.inference.symptom_para_id ?? item.para_id)}
                    />
                  ) : (
                    <p className="text-caption text-[#8A867E] italic">
                      “{item.quote}” - {source(item.para_id)}
                    </p>
                  )}
                  {item.label === "contradiction" && sides.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-caption font-bold text-[#B03030]">{t("sidesTitle")}</span>
                      <ul className="flex flex-col gap-0.5">
                        {sides.map((side, i) => (
                          <li key={`${item.id}-side-${i}`} className="text-caption text-[#4B4842]">
                            <span className="font-bold">{side.speaker ?? t("unknownSpeaker")}</span>: <span className="italic">“{side.quote}”</span> - {source(side.para_id)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.entity_paths.length > 0 && <p className="text-caption text-[#8A867E]">{t("touches", { paths: item.entity_paths.map((p, i) => elementText(p, item.entity_names?.[i] || undefined)).join(", ") })}</p>}
                  {editable && item.label === "inferred" && s.include && s.option === null && <p className="text-caption text-[#8A6D1F]">{t("inference.pickHint")}</p>}
                  {!s.include && editable && (
                    <input
                      aria-label={t("dropReasonAria", { id: item.id })}
                      value={s.dropReason}
                      onChange={(e) => patch(item.id, { dropReason: e.target.value })}
                      placeholder={t("dropReasonPlaceholder")}
                      className="w-full px-3 py-1.5 rounded-[8px] bg-[#F6F5F2] border border-[#ECEAE5] text-body outline-none"
                    />
                  )}
                  {approved && item.drop_reason && <p className="text-caption text-[#8A867E]">{t("dropped", { reason: item.drop_reason })}</p>}
                  {approved && item.answer && <p className="text-caption text-[#8A867E]">{t("answered", { answer: item.answer })}</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="text-body text-[#B03030] bg-[#FDEDED] border border-[#F2CACA] rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      {editable && (
        <div className="flex flex-wrap items-end gap-3 border-t border-[#ECEAE5] pt-3">
          <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <span className="text-caption font-bold text-[#4B4842]">{t("requester")}</span>
            <input value={requester} onChange={(e) => setRequester(e.target.value)} placeholder={t("requesterPlaceholder")} className="px-3 py-1.5 rounded-[8px] bg-white border border-[#ECEAE5] text-body outline-none" />
          </label>
          <button type="button" disabled={!canSubmit} onClick={() => void submit()} className="px-4 py-2 rounded-full btn-gradient-primary text-white text-body font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" title={problems.length ? t("problems", { count: problems.length }) : undefined}>
            {busy ? t("creating") : t("create", { count: crCount })}
          </button>
          {problems.length > 0 && <p className="w-full text-caption text-[#8A6D1F]">{t("problems", { count: problems.length })}</p>}
        </div>
      )}
    </section>
  );
}
