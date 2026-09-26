"use client";

import { useEffect, useState, type ReactNode } from "react";
import Icon from "@/components/ui/Icon";
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
  /** Section vừa đổi sau khi step ghi op hoặc lệnh sửa trong chat áp một lô — nền nổi bật một nhịp. */
  changedSectionIds?: ReadonlySet<string>;
  onSelectStep?: (stepId: string) => void;
  /** Tăng để buộc tải lại tài liệu (sau `ops_applied`, gate, hoặc lệnh sửa trong chat áp lô). */
  refreshToken?: number;
  /** `spine_version` hiện tại — có thì nút ghép gọi `POST /assemble` thẳng thay vì chỉ chuyển sang S-8.2. */
  getBaseVersion?: () => number | null;
  /**
   * Mode 1 v2 (FLF-185): step sở hữu section chưa có nội dung — hiện "Chưa có nội dung — chạy step X" thay câu chung,
   * `missing` = đầu mục mẫu FPT file upload không có (đỏ).
   */
  emptyHintOf?: (sectionId: string) => EmptyHint | undefined;
  /**
   * Mode 1 v3 (bám BPMN): không có step ⇒ ẩn nhãn trạng thái theo step (Accepted/Draft…), mục trống mời tạo change
   * request thay vì "chờ step chạy".
   */
  mode1?: boolean;
  /** "Sửa mục này" trên từng mục — nhận nhãn mục (`§3.2 Actors`) để điền sẵn lệnh sửa vào ô chat. */
  onEditSection?: (sectionLabel: string) => void;
  /**
   * Chip trạng thái duy nhất trên header: số vấn đề phải xử lý (cờ đỏ + mục cần viết lại) và số gợi ý (cờ vàng).
   * Bấm mở panel "Kiểm tra tài liệu".
   */
  issues?: { blocking: number; suggestions: number };
  onOpenIssues?: () => void;
  /** Bấm chấm số trên một mục ⇒ mở panel kiểm tra, lọc theo mục đó. */
  onOpenSectionIssues?: (sectionId: string) => void;
  /** Lỗi của lượt viết lại các mục cũ. */
  rewriteError?: string | null;
  /** Báo danh sách mục đang hiển thị — panel kiểm tra dùng để gọi tên mục (`§2.2.2 Actors`). */
  onSectionsLoaded?: (sections: readonly RenderedSection[]) => void;
  /** Nút thêm ở cuối header (vd. thoát mở rộng trang). */
  headerEnd?: ReactNode;
}

/** Nhãn đọc được của một mục: `§2.2.2 Actors`. */
export const sectionLabel = (section: Pick<RenderedSection, "number" | "heading">): string =>
  `§${section.number ? `${section.number} ` : ""}${section.heading}`;

export interface EmptyHint {
  stepId: string;
  missing: boolean;
}

const STATUS_BADGE: Record<SectionStatus, { text: string; style: string }> = {
  accepted: { text: "Accepted", style: "bg-[#E9F7EE] text-[#1F7A45]" },
  draft: { text: "Draft", style: "bg-[#F2F1FB] text-[#554DB0]" },
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
        // Unmount (hoặc đổi `png`) trước khi fetch xong: blob URL vừa tạo không còn ai revoke ở
        // cleanup bên dưới (nó chạy trước khi promise này resolve) — revoke ngay tại đây.
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
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

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

/** Bảng đứng ngay dưới tiêu đề (tiêu đề section hoặc heading con) — cần khoảng trống để không dính sát tiêu đề. */
export const followsHeading = (blocks: Block[], index: number): boolean => index === 0 || blocks[index - 1]?.type === "heading";

/** Dùng lại ở `view/page.tsx` (read-only) để không lặp logic render Block. */
export function BlockView({ block, projectId, afterHeading = false }: { block: Block; projectId: string; afterHeading?: boolean }) {
  switch (block.type) {
    case "heading": {
      const Tag = HEADING_TAGS[Math.min(6, Math.max(1, block.level)) - 1];
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
        <div className={`overflow-x-auto mb-2 ${afterHeading ? "mt-2" : ""}`}>
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

/** Mỗi cấp mục con thụt vào thêm bấy nhiêu px (1 → 1.1 → 1.1.1). */
const INDENT_PER_LEVEL = 20;

/** Cấp của section, 0 = mục gốc: theo `level` của BE (1-based), thiếu thì đếm dấu chấm trong số mục. */
const depthOf = (section: RenderedSection): number =>
  Math.max(0, (section.level || (section.number ? section.number.split(".").length : 1)) - 1);

/** Cỡ chữ tiêu đề theo cấp: mục gốc to nhất, mục con nhỏ dần. */
const HEADING_SIZE = ["text-[15px]", "text-[13.5px]", "text-[12.5px]"] as const;
const headingSize = (depth: number) => HEADING_SIZE[Math.min(depth, HEADING_SIZE.length - 1)];

/** Heading nhóm (`group:*`) — chỉ tiêu đề chương/mục cha, không phải section có nội dung (contract-change 2026-09-15). */
function GroupHeading({ section }: { section: RenderedSection }) {
  const depth = depthOf(section);
  return (
    <div data-section-id={section.id} className="pt-4 first:pt-0" style={{ marginLeft: depth * INDENT_PER_LEVEL }}>
      <h4 className={`font-extrabold text-on-surface ${headingSize(depth)}`}>
        {section.number ? `${section.number}. ` : ""}
        {section.heading}
      </h4>
    </div>
  );
}

function EmptySection({ hint, onSelectStep, mode1 = false }: { hint?: EmptyHint; onSelectStep?: (stepId: string) => void; mode1?: boolean }) {
  if (mode1) return <div className="text-[11.5px] text-[#A8A49C] italic">Mục còn trống — tạo change request (nguồn gap report) để bổ sung.</div>;
  if (!hint) return <div className="text-[11.5px] text-[#A8A49C] italic">Chưa hoàn thiện — nội dung sẽ có khi step sở hữu section chạy.</div>;
  return (
    <div className={`text-[11.5px] italic flex items-center gap-2 flex-wrap ${hint.missing ? "text-[#B03030]" : "text-[#8A867E]"}`}>
      {hint.missing && <span className="not-italic text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#B03030] text-white">Thiếu</span>}
      <span>
        Chưa có nội dung — chạy step {hint.stepId} · {stepLabel(hint.stepId)}
      </span>
      {onSelectStep && (
        <button type="button" onClick={() => onSelectStep(hint.stepId)} className="not-italic text-[10.5px] font-bold text-[#6A62C4] hover:underline cursor-pointer">
          Mở step
        </button>
      )}
    </div>
  );
}

function SectionView({
  section,
  projectId,
  issues,
  onOpenIssues,
  changed,
  onSelectStep,
  emptyHint,
  mode1 = false,
  onEdit,
}: {
  onEdit?: (sectionLabel: string) => void;
  section: RenderedSection;
  projectId: string;
  /** Vấn đề đang mở của mục: số lượng và có cái nào chặn chốt bản không. */
  issues?: { count: number; blocking: boolean };
  onOpenIssues?: () => void;
  changed: boolean;
  onSelectStep?: (stepId: string) => void;
  emptyHint?: EmptyHint;
  mode1?: boolean;
}) {
  if (section.id.startsWith("group:")) return <GroupHeading section={section} />;
  const badge = section.status && !mode1 ? STATUS_BADGE[section.status] : null;
  const custom = section.id.startsWith("custom:");
  const depth = depthOf(section);
  return (
    <article
      data-section-id={section.id}
      // Mục con thụt vào so với mục cha (inline style: độ sâu là dữ liệu, không phải class tĩnh); −12px bù phần đệm
      // ngang dành cho nền nổi bật, để chữ của mục gốc thẳng hàng với heading nhóm
      style={{ marginLeft: depth * INDENT_PER_LEVEL - 12 }}
      // Không khung/viền: tài liệu đọc liền mạch như bản xuất. Section vừa đổi qua chat nổi lên bằng nền tím nhạt một
      // nhịp (thay cho viền nổi bật trước đây) — chỉ là hiển thị, không liên quan dữ liệu hay file xuất.
      className={`group/section -mr-3 px-3 py-1.5 rounded-control flex flex-col gap-1.5 transition-colors duration-500 ${changed ? "bg-primary-soft" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h5 className={`font-bold text-on-surface ${headingSize(depth)}`}>
          {section.number ? `${section.number}. ` : ""}
          {section.heading}
        </h5>
        <div className="flex items-center gap-1.5 flex-wrap">
          {custom && (
            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-[#F0EEEA] text-[#6B6862]" title="Mục ngoài mẫu FPT — giữ nguyên văn từ file upload, sửa qua chat">
              Mục riêng
            </span>
          )}
          {section.awaiting_reaccept && (
            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-[#FBF4E4] text-[#8A6D1F]">Chờ duyệt lại</span>
          )}
          {badge && <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${badge.style}`}>{badge.text}</span>}
          {issues && issues.count > 0 && (
            // Chỉ một chấm + số: nội dung vấn đề nằm trong panel, tài liệu giữ để đọc
            <button
              type="button"
              onClick={onOpenIssues}
              title="Xem vấn đề của mục này"
              className={`flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full cursor-pointer ${
                issues.blocking ? "bg-error-container text-error" : "bg-accent-gold-soft text-accent-gold-text"
              }`}
            >
              <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${issues.blocking ? "bg-error" : "bg-accent-gold"}`} />
              {issues.count}
            </button>
          )}
          {onEdit && (
            // Hiện khi rê chuột / focus vào mục: sửa ngay chỗ đang đọc, lệnh gõ tiếp ở ô chat
            <button
              type="button"
              onClick={() => onEdit(sectionLabel(section))}
              className="opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 text-[10.5px] font-bold px-2 py-0.5 rounded-full text-primary hover:bg-primary-soft cursor-pointer transition-opacity"
            >
              Sửa mục này
            </button>
          )}
        </div>
      </div>
      {section.blocks.length > 0 ? (
        section.blocks.map((block, i) => (
          <BlockView key={i} block={block} projectId={projectId} afterHeading={followsHeading(section.blocks, i)} />
        ))
      ) : (
        <EmptySection hint={emptyHint} onSelectStep={onSelectStep} mode1={mode1} />
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
  getBaseVersion,
  emptyHintOf,
  mode1 = false,
  onEditSection,
  issues,
  onOpenIssues,
  onOpenSectionIssues,
  rewriteError = null,
  onSectionsLoaded,
  headerEnd,
}: DocumentPaneProps) {
  const { document, meta, loading, notAssembled, error, reload, assemble, assembling, assembleError } = useDocument(
    projectId,
    "draft",
    undefined,
    refreshToken
  );
  const runAssemble = getBaseVersion ? () => void assemble(getBaseVersion()) : undefined;

  useEffect(() => {
    if (document) onSectionsLoaded?.(document.sections);
  }, [document, onSectionsLoaded]);

  const openFlags = flags.filter((f) => !f.resolved_at && !f.waived_by_user);
  const issuesOf = (sectionId: string) => {
    const own = openFlags.filter((f) => f.section_id === sectionId);
    return { count: own.length, blocking: own.some((f) => f.level === "red") };
  };

  return (
    <section className="flex-1 bg-surface-container-lowest flex flex-col min-w-[320px] overflow-hidden">
      <div className="ff-fade-below [--ff-fade:var(--color-surface-container-lowest)] px-6 flex items-center justify-between gap-3 shrink-0 h-12 bg-surface-container-lowest">
        {/* Tên dài thì cắt "…", nhãn không bao giờ xuống dòng */}
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-bold text-[13.5px] text-on-surface truncate" title={`SRS — ${projectName}`}>
            SRS — {projectName}
          </h3>
          {document && (
            <span className="shrink-0 whitespace-nowrap text-[10.5px] text-[#8A867E] bg-[#F5F3F0] px-2 py-0.5 rounded-full font-mono">{document.version}</span>
          )}
          {document?.watermark && (
            <span className="shrink-0 whitespace-nowrap text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-[#FBF4E4] text-[#8A6D1F]">{document.watermark}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {issues && onOpenIssues && (
            <button
              type="button"
              onClick={onOpenIssues}
              title="Mở danh sách vấn đề của tài liệu"
              className={`h-8 px-3 flex items-center gap-1.5 whitespace-nowrap rounded-control text-[12px] font-bold cursor-pointer transition-colors ${
                issues.blocking > 0
                  ? "bg-error-container text-error hover:opacity-90"
                  : issues.suggestions > 0
                    ? "bg-accent-gold-soft text-accent-gold-text hover:opacity-90"
                    : "text-success hover:bg-surface-container-high"
              }`}
            >
              <Icon name={issues.blocking > 0 || issues.suggestions > 0 ? "warning" : "check-circle"} size={14} />
              {issues.blocking > 0
                ? `${issues.blocking} vấn đề cần xử lý`
                : issues.suggestions > 0
                  ? `${issues.suggestions} gợi ý nên xem`
                  : "Không có vấn đề"}
            </button>
          )}
          {/* Một nút "Làm mới": tài liệu đã đổi sau lần ghép gần nhất ⇒ ghép lại; không thì chỉ tải lại */}
          <button
            type="button"
            onClick={meta?.stale && runAssemble ? runAssemble : () => void reload()}
            disabled={assembling}
            title={meta?.stale ? "Nội dung đã đổi — ghép lại tài liệu cho khớp" : "Tải lại tài liệu"}
            className="relative h-8 px-3 whitespace-nowrap rounded-control text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface text-[12px] font-bold cursor-pointer transition-colors disabled:opacity-60"
          >
            {assembling ? "Đang làm mới…" : "Làm mới"}
            {/* Chấm tím: có nội dung mới chưa ghép vào tài liệu */}
            {meta?.stale && !assembling && <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
          {headerEnd}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto ff-scroll px-8 py-6 space-y-1.5 bg-surface-container-lowest">
        {/* Lỗi nằm trong vùng cuộn: đặt ngay dưới header thì bị lớp mờ của header che */}
        {rewriteError && (
          <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-[11.5px] text-error">
            Không viết lại được các mục cũ: {rewriteError}
          </p>
        )}
        {loading && <div className="text-[12px] text-[#A8A49C] italic">Đang tải tài liệu…</div>}

        {!loading && notAssembled && (
          <div className="bg-white border border-dashed border-[#E4E1DC] rounded-[14px] p-5 flex flex-col items-center gap-2 text-center">
            <span className="text-[12.5px] font-bold text-[#4B4842]">Chưa có bản ghép tài liệu</span>
            <span className="text-[11px] text-[#8A867E] leading-relaxed">{error}</span>
            {runAssemble ? (
              <button
                type="button"
                onClick={runAssemble}
                disabled={assembling}
                className="mt-1 px-3.5 py-1.5 rounded-full text-[11.5px] font-bold bg-[#191817] text-white cursor-pointer disabled:opacity-60"
              >
                {assembling ? "Đang ghép tài liệu…" : "Ghép tài liệu ngay"}
              </button>
            ) : (
              onSelectStep && (
                <button
                  type="button"
                  onClick={() => onSelectStep("S-8.2")}
                  className="mt-1 px-3.5 py-1.5 rounded-full text-[11.5px] font-bold bg-[#191817] text-white cursor-pointer"
                >
                  Đi tới S-8.2 · Ghép tài liệu
                </button>
              )
            )}
          </div>
        )}

        {assembleError && (
          <div className="bg-[#FDEDED] border border-[#F2CACA] rounded-[14px] p-3.5 text-[11.5px] text-[#8A4141]">
            Không ghép được tài liệu: {assembleError}
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
              issues={issuesOf(section.id)}
              onOpenIssues={onOpenSectionIssues ? () => onOpenSectionIssues(section.id) : undefined}
              changed={changedSectionIds?.has(section.id) ?? false}
              onSelectStep={onSelectStep}
              emptyHint={section.blocks.length === 0 ? emptyHintOf?.(section.id) : undefined}
              mode1={mode1}
              onEdit={onEditSection}
            />
          ))}
      </div>
    </section>
  );
}
