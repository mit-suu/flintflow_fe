"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { KnowledgeCitation } from "@/types/chat";
import { splitCitationRefs } from "./knowledge-citations";

interface KnowledgeAnswerProps {
  reply: string;
  grounded: boolean;
  citations: KnowledgeCitation[];
}

/**
 * Chip trích dẫn `[K1]` + ô chi tiết nguồn.
 *
 * Ô mở LÊN TRÊN (`bottom-full`): khung chat cuộn và tin mới nhất nằm sát đáy khung, nên ô mở xuống dưới
 * sẽ bị mép dưới cắt đúng ở tin người ta vừa đọc.
 */
function CitationChip({ citation }: { citation: KnowledgeCitation }) {
  const t = useTranslations("workspace.knowledge");
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // Tab sang chip kế tiếp cũng phải đóng: chỉ bắt chuột và Escape thì người dùng bàn phím mở được
    // nhiều ô chi tiết chồng lên nhau.
    const onFocusIn = (e: FocusEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-block align-baseline">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? noteId : undefined}
        aria-label={t("sourceLabel", { ref: citation.ref, source: citation.source, section: citation.section })}
        className={`px-1.5 rounded-inner text-caption font-bold align-baseline transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          open ? "bg-primary text-on-primary" : "bg-primary-soft text-primary-hover hover:bg-primary-fixed"
        }`}
      >
        [{citation.ref}]
      </button>

      {open && (
        <span
          id={noteId}
          role="note"
          className="absolute bottom-full left-0 mb-1.5 z-40 w-[260px] max-w-[min(260px,70vw)] flex flex-col gap-1 rounded-card bg-surface-container-lowest p-3 text-left shadow-[0_8px_24px_rgba(25,24,23,0.14)]"
        >
          <span className="text-body font-bold text-on-surface">{citation.source}</span>
          <span className="text-body text-on-surface-variant">{citation.section}</span>
          <span className="text-caption font-semibold text-primary">{t(`kind.${citation.source_kind}`)}</span>
        </span>
      )}
    </span>
  );
}

/**
 * Câu trả lời tri thức (`pipeline-contract.md` §1.2).
 *
 * `grounded: false` phải phân biệt được với tin lỗi hệ thống KHI KHÔNG ĐỌC CHỮ — kho tri thức không có
 * câu trả lời là chuyện bình thường, không phải sự cố. Dùng tông cảnh báo (vàng) như `GateCard`, để tông
 * lỗi (đỏ) dành riêng cho sự cố thật.
 */
export default function KnowledgeAnswer({ reply, grounded, citations }: KnowledgeAnswerProps) {
  const t = useTranslations("workspace.knowledge");
  if (!grounded) {
    return (
      <div className="flex flex-col gap-1.5 rounded-control bg-accent-gold-soft p-3 text-accent-gold-text">
        <span className="flex items-center gap-1.5 text-body font-bold">
          <Icon name="warning" size={15} />
          {t("notGrounded")}
        </span>
        <p className="text-body leading-relaxed whitespace-pre-wrap">{reply}</p>
      </div>
    );
  }

  const parts = splitCitationRefs(reply, citations);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body text-on-surface leading-relaxed whitespace-pre-wrap">
        {parts.map((part, i) =>
          typeof part === "string" ? (
            <span key={i}>{part}</span>
          ) : (
            <CitationChip key={`${part.ref}-${i}`} citation={part} />
          )
        )}
      </p>

      {/* Liệt kê nguồn ở dưới: thấy được trả lời dựa trên mấy nguồn mà không phải bấm từng chip — và là
          đường thoát khi `reply` không chứa nhãn nào khớp (tin cũ, hoặc BE đổi dạng nhãn). */}
      {citations.length > 0 && (
        <p className="text-caption text-on-surface-muted">
          {t("sources", { list: citations.map((c) => `${c.source} · ${c.section}`).join(" · ") })}
        </p>
      )}
    </div>
  );
}
