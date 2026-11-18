"use client";

import { useTranslations } from "next-intl";
import type { RequirementSource, RequirementSourceRef } from "@/types/sources";
import AnchoredPopover from "./AnchoredPopover";
import { paragraphLabel } from "./source-labels";
import { useReferenceViewer } from "./reference-viewer/ReferenceViewerProvider";

/** Trần câu trích trong popover (BE cũng giữ tối đa 5 đoạn mỗi phần tử). */
const MAX_QUOTES = 5;

/** `GET /sources` ⇒ tra theo đường dẫn phần tử (`functions[id=FN3]`), dựng một lần mỗi lần nguồn tải lại. */
export const sourcesByPath = (sources: readonly RequirementSource[]): ReadonlyMap<string, RequirementSourceRef[]> =>
  new Map(sources.filter((s) => s.refs.length > 0).map((s) => [s.path, s.refs]));

/** Section chi tiết `function:FN3` / `feature:F2` ⇒ đường dẫn phần tử tương ứng; section khác ⇒ null. */
export const sectionEntityPath = (sectionId: string): string | null => {
  const m = /^(function|feature):(.+)$/.exec(sectionId);
  return m ? `${m[1] === "function" ? "functions" : "features"}[id=${m[2]}]` : null;
};

/**
 * Chip "Nguồn · n" (FLF-443) ở cuối đoạn / dòng / mục có nguồn: bấm ⇒ câu trích + tên tài liệu + "Mở tài liệu" (nhảy đúng
 * đoạn). Tài liệu đã xoá ⇒ vẫn hiện câu trích, không có link mở.
 */
export default function SourceChip({ refs }: { refs: readonly RequirementSourceRef[] }) {
  const t = useTranslations("workspace.sources");
  const viewer = useReferenceViewer();
  if (refs.length === 0) return null;
  const shown = refs.slice(0, MAX_QUOTES);

  return (
    <AnchoredPopover
      label={t("popoverLabel")}
      align="right"
      trigger={({ toggle, ...aria }) => (
        <button
          type="button"
          {...aria}
          onClick={toggle}
          aria-label={t("chipAria", { count: refs.length })}
          data-source-chip
          className="ml-1.5 inline-flex items-center align-baseline px-1.5 py-px rounded-full text-caption font-bold text-primary bg-primary-soft hover:bg-primary-fixed-dim/40 cursor-pointer whitespace-nowrap"
        >
          {t("chip", { count: refs.length })}
        </button>
      )}
    >
      {(close) => (
        <ul className="flex flex-col gap-2.5 p-3">
          {shown.map((ref) => (
            <li key={`${ref.document_id}:${ref.para_id}`} className="flex flex-col gap-1">
              <blockquote className="text-body text-on-surface leading-relaxed line-clamp-4">{ref.quote}</blockquote>
              <div className="flex flex-wrap items-center gap-x-2 text-caption text-on-surface-variant">
                <span>
                  {ref.document_name ?? t("deletedDocument")} · {paragraphLabel(ref.para_id, t)}
                </span>
                {ref.document_name !== null && viewer && (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      viewer.openDocument({ documentId: ref.document_id, name: ref.document_name, focusParaId: ref.para_id });
                    }}
                    className="font-bold text-primary hover:underline cursor-pointer"
                  >
                    {t("openDocument")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AnchoredPopover>
  );
}
