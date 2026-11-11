"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { DocumentUploadChoice, DocumentVersionCandidate } from "@/types/document";

interface DocumentVersionCardProps {
  fileName: string;
  candidates: DocumentVersionCandidate[];
  /** Lựa chọn của người dùng; `null` = Bỏ qua file này (không tải). */
  onChoose: (choice: DocumentUploadChoice | null) => void;
  busy?: boolean;
}

/**
 * FLF-398 — file vừa tải có vẻ là bản mới của tài liệu tham khảo đã có (BE `409 POSSIBLE_NEW_VERSION`): hỏi **Thay bản cũ**
 * (bản cũ ẩn khỏi danh sách và ngữ cảnh AI, trích dẫn cũ vẫn mở được) / **Giữ cả hai** / Bỏ qua. Nhiều ứng viên ⇒ chọn bản cần
 * thay (mặc định ứng viên đầu — BE đã xếp cùng tên trước, rồi độ giống giảm dần).
 */
export default function DocumentVersionCard({ fileName, candidates, onChoose, busy = false }: DocumentVersionCardProps) {
  const t = useTranslations("common.documentVersion");
  const [selected, setSelected] = useState(candidates[0]?.id ?? "");
  const label = (c: DocumentVersionCandidate) => (c.doc_code ? t("candidate", { name: c.name, code: c.doc_code }) : t("candidateNoCode", { name: c.name }));
  const why = (c: DocumentVersionCandidate) => (c.reason === "same_name" ? t("sameName") : t("similar", { percent: Math.round(c.similarity * 100) }));

  return (
    <section role="dialog" aria-label={t("aria")} className="rounded-control border border-outline-variant bg-surface-container-lowest p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <Icon name="file" size={20} />
        <div className="flex-1 min-w-0">
          <h3 className="text-body font-extrabold text-on-surface break-words">{t("title", { file: fileName })}</h3>
          <p className="text-caption text-on-surface-muted">{t("intro")}</p>
        </div>
      </div>
      {candidates.length === 1 ? (
        <p className="text-body text-on-surface">
          {label(candidates[0])} <span className="text-caption text-on-surface-muted">· {why(candidates[0])}</span>
        </p>
      ) : (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-caption font-bold text-on-surface-muted mb-1">{t("pick")}</legend>
          {candidates.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-body cursor-pointer">
              <input type="radio" name={`replace-${fileName}`} value={c.id} checked={selected === c.id} onChange={() => setSelected(c.id)} disabled={busy} />
              <span className="truncate">{label(c)}</span>
              <span className="text-caption text-on-surface-muted whitespace-nowrap">· {why(c)}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => onChoose(null)} disabled={busy} className="px-3 py-1.5 rounded-full text-body font-bold text-on-surface-muted cursor-pointer disabled:opacity-50">
          {t("skip")}
        </button>
        <button type="button" onClick={() => onChoose({ keepBoth: true })} disabled={busy} className="px-3 py-1.5 rounded-full text-body font-bold border border-outline-variant text-on-surface cursor-pointer disabled:opacity-50">
          {t("keepBoth")}
        </button>
        <button
          type="button"
          onClick={() => onChoose({ replaceDocumentId: selected })}
          disabled={busy || !selected}
          className="px-3 py-1.5 rounded-full text-body font-bold btn-gradient-primary text-white cursor-pointer disabled:opacity-50"
        >
          {t("replace")}
        </button>
      </div>
    </section>
  );
}
