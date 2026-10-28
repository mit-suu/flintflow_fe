"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@/lib/api/client";
import { approveExtraction } from "@/lib/api/extraction";
import { QUESTION_LABELS, type Extraction, type ExtractionDecision, type ExtractionItem } from "@/types/extraction";
import { useMode1Labels } from "./i18n";
import { crHref } from "./prefill";

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
}

const LABEL_TONE: Record<ExtractionItem["label"], string> = {
  new: "bg-[#E9F7EE] text-[#1F7A45]",
  modification: "bg-[#F2F1FB] text-[#554DB0]",
  duplicate: "bg-[#F0EEEA] text-[#6B6862]",
  contradiction: "bg-[#FDEDED] text-[#B03030]",
  ambiguous: "bg-[#FBF4E4] text-[#8A6D1F]"
};

/**
 * Danh sách rút yêu cầu (FLF-338 §3.6.1 bước 2–5): mỗi mục có nhãn gợi ý, trích dẫn + mã đoạn, nhóm; mọi câu hỏi (mâu thuẫn / mơ
 * hồ) gom một thẻ kèm gợi ý; BA tick mục đưa vào, bỏ mục nào phải ghi lý do, tách nhóm bằng cách đổi tên nhóm. "Tạo N change
 * request" ⇒ mỗi nhóm một CR; mục Trùng chỉ cần tick (không tạo CR, tài liệu thành nguồn của phần tử).
 */
export default function ExtractionList({ projectId, extraction, onApproved, readOnly = false }: ExtractionListProps) {
  const t = useTranslations("mode1.extraction");
  const L = useMode1Labels();
  const approved = extraction.status === "approved";
  const [requester, setRequester] = useState("");
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(extraction.items.map((i) => [i.id, { include: i.include ?? i.label !== "duplicate" ? (i.include ?? true) : true, dropReason: i.drop_reason ?? "", answer: i.answer ?? "", group: i.group }]))
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
    return QUESTION_LABELS.has(i.label) && s.answer.trim().length === 0;
  });
  const canSubmit = !approved && !readOnly && !busy && requester.trim().length > 0 && problems.length === 0 && included.length > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setBadIds(new Set());
    const decisions: ExtractionDecision[] = extraction.items.map((i) => {
      const s = state[i.id];
      return { id: i.id, include: s.include, drop_reason: s.include ? null : s.dropReason.trim(), answer: s.answer.trim() || null, group: s.group.trim() || null };
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

  const paraLabel = (item: ExtractionItem) => (item.para_id ? `${extraction.document_name} · ${item.para_id}` : extraction.document_name);

  return (
    <section className="flex flex-col gap-3" aria-label={t("aria", { name: extraction.document_name })}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-body font-extrabold text-[#191817]">{t("title", { name: extraction.document_name, count: extraction.items.length })}</h3>
        <span className="text-caption text-[#8A867E]">{approved ? t("approvedAt") : t("creditsUsed", { credits: extraction.credits })}</span>
      </div>
      <p className="text-caption text-[#8A867E]">{t("intro")}</p>

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
          return (
            <li key={item.id} className={`bg-white border rounded-[12px] px-3 py-2.5 flex flex-col gap-1.5 ${badIds.has(item.id) ? "border-[#B03030]" : "border-[#ECEAE5]"}`}>
              <div className="flex items-start gap-2">
                {!approved && !readOnly ? (
                  <input type="checkbox" aria-label={t("includeAria", { id: item.id })} checked={s.include} onChange={(e) => patch(item.id, { include: e.target.checked })} className="mt-1" />
                ) : (
                  <span className="mt-0.5 text-caption font-bold text-[#8A867E]">{item.include === false ? "✕" : "✓"}</span>
                )}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-caption font-bold text-[#6A62C4]">{item.id}</code>
                    <span className={`px-2 py-0.5 rounded-full text-caption font-bold ${LABEL_TONE[item.label]}`}>{t(`labels.${item.label}`)}</span>
                    <span className="text-caption text-[#8A867E]">{t("group")}</span>
                    {!approved && !readOnly && item.label !== "duplicate" ? (
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
                  <p className="text-caption text-[#8A867E] italic">
                    “{item.quote}” — {paraLabel(item)}
                  </p>
                  {item.entity_paths.length > 0 && <p className="text-caption text-[#8A867E]">{t("touches", { paths: item.entity_paths.join(", ") })}</p>}
                  {!s.include && !approved && !readOnly && (
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

      {!approved && !readOnly && (
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
