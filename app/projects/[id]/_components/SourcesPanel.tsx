"use client";

import { useTranslations } from "next-intl";
import type { Spine } from "@/types/spine";
import type { RequirementSource } from "@/types/sources";
import { SOURCE_KIND_ORDER, paragraphLabel, sourceEntityLabel } from "./source-labels";
import { hookErrorText } from "@/lib/hook-errors";

interface SourcesPanelProps {
  spine: Spine;
  sources: RequirementSource[];
  loading: boolean;
  error: string | null;
}

/**
 * Tab "Nguồn" của Hồ sơ dự án (FLF-292): yêu cầu nào được viết từ đoạn nào của tài liệu upload, kèm chữ gốc. Điều AI tự
 * giả định không có nguồn — chỉ đếm ở đây, duyệt ở tab "Chờ bạn quyết".
 */
export default function SourcesPanel({ spine, sources, loading, error }: SourcesPanelProps) {
  const t = useTranslations("workspace.sources");
  const tHook = useTranslations("workspace.hookErrors");
  const openAssumptions = spine.assumptions.filter((a) => a.status === "unconfirmed").length;

  if (error) return <p className="px-1 text-body text-error">{hookErrorText(error, tHook)}</p>;
  if (loading && sources.length === 0) return <p className="px-1 text-body text-on-surface-variant">{t("loading")}</p>;

  const labelled = sources.map((s) => ({ source: s, label: sourceEntityLabel(spine, s.path, t) }));
  const groups = SOURCE_KIND_ORDER.map((kind: string) => ({ kind, items: labelled.filter((l) => l.label.kind === kind) })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-body text-on-surface-variant leading-relaxed">
        <span className="font-semibold text-on-surface">{t("count", { count: sources.length })}</span>
        {openAssumptions > 0 && <> · {t("assumptions", { count: openAssumptions })}</>}
      </p>

      {sources.length === 0 ? (
        <p className="px-1 text-body text-on-surface-variant leading-relaxed">
          {t("empty")}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.kind} className="rounded-card bg-surface-container-lowest px-3.5 py-3 flex flex-col gap-2" aria-label={group.items[0].label.kindLabel}>
            <h5 className="text-body font-bold text-on-surface">
              {t("groupHeading", { label: group.items[0].label.kindLabel, count: group.items.length })}
            </h5>
            <ul className="flex flex-col gap-2.5">
              {group.items.map(({ source, label }) => (
                <li key={source.path} className="flex flex-col gap-1">
                  <p className="text-body text-on-surface">
                    {label.id && <span className="font-semibold">{label.id}</span>}
                    {label.id && label.title && " · "}
                    {label.title}
                  </p>
                  {source.refs.map((ref) => (
                    <figure key={ref.para_id} className="border-l-2 border-primary-fixed-dim pl-2.5">
                      <blockquote className="text-body text-on-surface-variant leading-relaxed line-clamp-3">{ref.quote}</blockquote>
                      <figcaption className="text-caption text-on-surface-variant">
                        {ref.document_name ?? t("deletedDocument")} · {paragraphLabel(ref.para_id, t)}
                      </figcaption>
                    </figure>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
