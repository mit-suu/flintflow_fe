"use client";

import { useEffect, useState } from "react";
import { fetchDiagramPng } from "@/lib/api/spine";
import { stepLabel } from "@/lib/constants/step-registry";
import { useDocument } from "../hooks/useDocument";
import type { Block, InlineRun, RenderedSection, SectionStatus, TableCell } from "@/types/document";
import type { Flag } from "@/types/flags";

interface DocumentPaneProps {
  projectId: string;
  projectName?: string;
  /** Cờ mở, dùng để gắn nút "xem tại step" theo `section_id` (nguồn duy nhất đáng tin cho map này). */
  flags?: Flag[];
  /** Section vừa đổi sau khi step ghi op hoặc ChangePanel áp một lô — viền nổi bật một nhịp. */
  changedSectionIds?: ReadonlySet<string>;
  onSelectStep?: (stepId: string) => void;
  /** Tăng để buộc tải lại tài liệu (sau `ops_applied`, gate, hoặc ChangePanel áp lô). */
  refreshToken?: number;
}

const STATUS_BADGE: Record<SectionStatus, { text: string; style: string }> = {
  accepted: { text: "Accepted", style: "bg-[#E9F7EE] text-[#1F7A45]" },
  draft: { text: "Draft", style: "bg-[#F4F3FE] text-[#3B34B0]" },
  stale: { text: "Cũ", style: "bg-[#FBF4E4] text-[#8A6D1F]" },
  derived: { text: "Dẫn xuất", style: "bg-[#F0EEEA] text-[#6B6862]" },
};

const runClass = (run: InlineRun): string =>
  [run.bold ? "font-bold" : "", run.italic ? "italic" : "", run.code ? "font-mono bg-[#F0EEEA] px-1 rounded-[4px]" : ""]
    .filter(Boolean)
    .join(" ");

const Runs = ({ runs }: { runs: InlineRun[] }) => (
  <>
    {runs.map((run, i) => (
      <span key={i} className={runClass(run) || undefined}>
        {run.text}
      </span>
    ))}
  </>
);

const Cell = ({ cell }: { cell: TableCell }) => <Runs runs={cell} />;

/** Ảnh trong tài liệu: base64 thật hoặc tham chiếu `diagram-ref:<id>` (cache nội bộ BE lộ ra). */
function DocumentImage({ projectId, png, caption }: { projectId: string; png: string; caption?: string }) {
  const isDiagramRef = png.startsWith("diagram-ref:");
  const directSrc = isDiagramRef ? null : `data:image/png;base64,${png}`;
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDiagramRef) return;
    const diagramId = png.slice("diagram-ref:".length);
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchDiagramPng(projectId, diagramId)
      .then((url) => {
        if (cancelled) return;
        objectUrl = url;
        setResolvedSrc(url);
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : "Không tải được ảnh diagram"));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, png, isDiagramRef]);

  const src = directSrc ?? resolvedSrc;
  if (error) return <div className="text-[11px] text-[#B03030] italic">Không tải được ảnh: {error}</div>;
  if (!src) return <div className="text-[11px] text-[#A8A49C] italic">Đang tải ảnh…</div>;
  // eslint-disable-next-line @next/next/no-img-element -- ảnh render server-side (base64/blob), không phải asset tĩnh Next
  return <img src={src} alt={caption ?? "Diagram"} className="max-w-full rounded-[8px] border border-[#ECEAE5]" />;
}

/** Dùng lại ở `view/page.tsx` (read-only) để không lặp logic render Block. */
export function BlockView({ block, projectId }: { block: Block; projectId: string }) {
  switch (block.type) {
    case "heading": {
      const Tag = (`h${Math.min(6, Math.max(1, block.level))}` as unknown) as "h1";
      return <Tag className="font-extrabold text-[#191817] mt-2 mb-1 text-[13px]">{block.text}</Tag>;
    }
    case "paragraph":
      return (
        <p className="mb-2 last:mb-0 text-[12px] text-[#33312D] leading-relaxed">
          <Runs runs={block.runs} />
        </p>
      );
    case "bullet_list":
      return (
        <ul className="list-disc pl-5 mb-2 space-y-0.5 text-[12px] text-[#33312D]">
          {block.items.map((item, i) => (
            <li key={i}>
              <Runs runs={item} />
            </li>
          ))}
        </ul>
      );
    case "numbered_list":
      return (
        <ol className="list-decimal pl-5 mb-2 space-y-0.5 text-[12px] text-[#33312D]">
          {block.items.map((item, i) => (
            <li key={i}>
              <Runs runs={item} />
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto mb-2">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {block.header.map((cell, i) => (
                  <th key={i} className="border border-[#ECEAE5] bg-[#FAF9F7] px-2 py-1 text-left font-bold">
                    <Cell cell={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-[#ECEAE5] px-2 py-1 align-top">
                      <Cell cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "image":
      return (
        <div className="mb-2 flex flex-col items-center gap-1">
          <DocumentImage projectId={projectId} png={block.png} caption={block.caption} />
          {block.caption && <span className="text-[10.5px] text-[#8A867E] italic">{block.caption}</span>}
        </div>
      );
    case "page_break":
      return <hr className="my-3 border-dashed border-[#E4E1DC]" />;
  }
}

function SectionView({
  section,
  projectId,
  remediationStep,
  changed,
  onSelectStep,
}: {
  section: RenderedSection;
  projectId: string;
  remediationStep?: string;
  changed: boolean;
  onSelectStep?: (stepId: string) => void;
}) {
  const badge = section.status ? STATUS_BADGE[section.status] : null;
  return (
    <article
      data-section-id={section.id}
      className={`p-4 rounded-[12px] border bg-white flex flex-col gap-2 transition-colors ${
        changed ? "border-[#4F46E5] ring-1 ring-[#DDD9F6]" : "border-[#ECEAE5]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h5 className="font-bold text-[12.5px] text-[#191817]">
          §{section.number} {section.heading}
        </h5>
        <div className="flex items-center gap-1.5 flex-wrap">
          {section.awaiting_reaccept && (
            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-[#FBF4E4] text-[#8A6D1F]">Chờ duyệt lại</span>
          )}
          {badge && <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${badge.style}`}>{badge.text}</span>}
          {remediationStep && onSelectStep && (
            <button
              type="button"
              onClick={() => onSelectStep(remediationStep)}
              className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-[#F4F3FE] text-[#4F46E5] hover:bg-[#EDEAFB] cursor-pointer"
            >
              xem tại {remediationStep} · {stepLabel(remediationStep)}
            </button>
          )}
        </div>
      </div>
      {section.blocks.length > 0 ? (
        section.blocks.map((block, i) => <BlockView key={i} block={block} projectId={projectId} />)
      ) : (
        <div className="text-[11.5px] text-[#A8A49C] italic">Chưa hoàn thiện — nội dung sẽ có khi step sở hữu section chạy.</div>
      )}
    </article>
  );
}

/** Document pane thật (T16): render `GET /document` (RenderedDocument, T15) — chỉ đọc. */
export default function DocumentPane({
  projectId,
  projectName = "Dự án",
  flags = [],
  changedSectionIds,
  onSelectStep,
  refreshToken = 0,
}: DocumentPaneProps) {
  const { document, meta, loading, notAssembled, error, reload } = useDocument(projectId, "draft", undefined, refreshToken);

  const remediationStepOf = (sectionId: string): string | undefined =>
    flags.find((f) => (!f.resolved_at && !f.waived_by_user) && f.section_id === sectionId)?.remediation_step;

  return (
    <section className="flex-1 bg-white flex flex-col min-w-[320px] overflow-hidden">
      <div className="px-6 py-3 border-b border-[#ECEAE5] flex items-center justify-between shrink-0 h-[52px] bg-white">
        <div className="flex items-center gap-2.5">
          <h3 className="font-extrabold text-[13.5px] text-[#191817]">SRS — {projectName}</h3>
          {document && <span className="text-[10.5px] text-[#8A867E] bg-[#F5F3F0] px-2 py-0.5 rounded-full font-mono">{document.version}</span>}
          {document?.watermark && (
            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-[#FBF4E4] text-[#8A6D1F]">{document.watermark}</span>
          )}
          {meta?.stale && (
            <span
              className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-[#FDEDED] text-[#B03030]"
              title="Spine đã đổi tiếp sau lần ghép gần nhất"
            >
              stale
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="px-3 py-1 rounded-full bg-[#FAF9F7] hover:bg-[#F4F3FE] border border-[#ECEAE5] text-[#4F46E5] text-[11.5px] font-bold cursor-pointer"
        >
          ↻ Tải lại
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#FAF9F7]">
        {loading && <div className="text-[12px] text-[#A8A49C] italic">Đang tải tài liệu…</div>}

        {!loading && notAssembled && (
          <div className="bg-white border border-dashed border-[#E4E1DC] rounded-[14px] p-5 flex flex-col items-center gap-2 text-center">
            <span className="text-[12.5px] font-bold text-[#4B4842]">Chưa có bản ghép tài liệu</span>
            <span className="text-[11px] text-[#8A867E] leading-relaxed">{error}</span>
            {onSelectStep && (
              <button
                type="button"
                onClick={() => onSelectStep("S-8.2")}
                className="mt-1 px-3.5 py-1.5 rounded-full text-[11.5px] font-bold bg-[#191817] text-white cursor-pointer"
              >
                Đi tới S-8.2 · Ghép tài liệu
              </button>
            )}
          </div>
        )}

        {!loading && !notAssembled && error && (
          <div className="bg-[#FDEDED] border border-[#F2CACA] rounded-[14px] p-3.5 text-[11.5px] text-[#8A4141]">
            Không tải được tài liệu: {error}
          </div>
        )}

        {!loading &&
          document &&
          document.sections.map((section) => (
            <SectionView
              key={section.id}
              section={section}
              projectId={projectId}
              remediationStep={remediationStepOf(section.id)}
              changed={changedSectionIds?.has(section.id) ?? false}
              onSelectStep={onSelectStep}
            />
          ))}
      </div>
    </section>
  );
}
