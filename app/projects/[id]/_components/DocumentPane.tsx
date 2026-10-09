"use client";

import { useEffect, useState, type ReactNode } from "react";
import Icon from "@/components/ui/Icon";
import { fetchDiagramPng } from "@/lib/api/spine";
import { stepLabel } from "@/lib/constants/step-registry";
import { shownDocumentLanguage } from "@/lib/document-language";
import { useDocument } from "../hooks/useDocument";
import DocumentLanguageChip from "./DocumentLanguageChip";
import type { Block, InlineRun, RenderedSection, SectionStatus, TableCell } from "@/types/document";
import type { Flag } from "@/types/flags";
import type { DocumentLanguage } from "@/types/project";
import { userErrorMessage } from "@/lib/api/error-messages";

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
  /**
   * Nút "Vẽ lại sơ đồ" dưới các hình của một mục. Ảnh tới FE đã là PNG thật (BE thay `diagram-ref:<id>` lúc trả tài liệu),
   * không còn id sơ đồ ⇒ nút theo MỤC, trang workspace biết mục nào có sơ đồ nào qua `diagrams[].section`.
   * Không truyền ⇒ không có nút (mode 1, trang xem read-only).
   */
  onRedrawSection?: (sectionId: string) => Promise<void>;
  /** Mục có sơ đồ vẽ lại được (có trong `diagrams[]` của Spine). */
  hasDiagrams?: (sectionId: string) => boolean;
  /**
   * Ngôn ngữ tài liệu client đã biết (FLF-265, `knownDocumentLanguage`): chip trên header và khoá tải lại — đổi ngôn ngữ
   * là gỡ tài liệu cũ xuống. `null` (mode 1 chưa biết ngôn ngữ file) ⇒ chỉ hiện chip khi BE trả `meta.translation`.
   */
  documentLanguage?: DocumentLanguage | null;
  /**
   * Mở hộp "Dịch tài liệu" khi còn mục chưa dịch. Chỉ truyền cho Lead/Analyst ở mode 2 — không truyền thì cảnh báo
   * "N mục chưa dịch" vẫn hiện nhưng không có nút (Viewer chỉ đọc, mode 1 không dịch — D3).
   */
  onTranslate?: () => void;
}

/** "Vẽ lại sơ đồ" của một mục: vẽ lại bằng code hiện tại dù dữ liệu không đổi (vd đổi kiểu đường ERD). */
function RedrawSectionButton({ onRedraw }: { onRedraw: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redraw = async () => {
    setBusy(true);
    setError(null);
    try {
      await onRedraw();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không vẽ lại được sơ đồ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center justify-center gap-2 mb-2">
      <button
        type="button"
        onClick={() => void redraw()}
        disabled={busy}
        title="Vẽ lại sơ đồ của mục này từ dữ liệu hiện tại"
        className="inline-flex items-center gap-1 text-caption font-bold px-2 py-0.5 rounded-full text-primary hover:bg-primary-soft cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Icon name="refresh" size={11} />
        {busy ? "Đang vẽ…" : "Vẽ lại sơ đồ"}
      </button>
      {error && <span className="text-caption text-error">{error}</span>}
    </div>
  );
}

/** Nhãn đọc được của một mục: `§2.2.2 Actors`. */
export const sectionLabel = (section: Pick<RenderedSection, "number" | "heading">): string =>
  `§${section.number ? `${section.number} ` : ""}${section.heading}`;

export interface EmptyHint {
  stepId: string;
  missing: boolean;
}

const STATUS_BADGE: Record<SectionStatus, { text: string; style: string } | null> = {
  accepted: { text: "Accepted", style: "bg-success-soft text-success" },
  // `draft` là trạng thái mặc định của mọi mục chưa chốt: gắn nhãn cho tất cả thì nhãn thành nhiễu, không thành tin
  draft: null,
  stale: { text: "Cũ", style: "bg-accent-gold-soft text-accent-gold-text" },
  derived: { text: "Dẫn xuất", style: "bg-surface-container-high text-on-surface-variant" },
};

const runClass = (run: InlineRun): string =>
  [run.bold ? "font-bold" : "", run.italic ? "italic" : "", run.code ? "font-mono bg-surface-container-high px-1 rounded-[4px]" : ""]
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
      .catch((err: unknown) => !cancelled && setError(userErrorMessage(err, "Không tải được hình sơ đồ.")));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, png, isDiagramRef]);

  const src = directSrc ?? resolvedSrc;
  if (error) return <div className="text-caption text-error italic">{error}</div>;
  if (!src) return <div className="text-caption text-on-surface-subtle italic">Đang tải ảnh…</div>;
  // eslint-disable-next-line @next/next/no-img-element -- ảnh render server-side (base64/blob), không phải asset tĩnh Next
  return <img src={src} alt={caption ?? "Diagram"} className="max-w-full rounded-inner" />;
}

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

/** Bảng đứng ngay dưới tiêu đề (tiêu đề section hoặc heading con) — cần khoảng trống để không dính sát tiêu đề. */
export const followsHeading = (blocks: Block[], index: number): boolean => index === 0 || blocks[index - 1]?.type === "heading";

/** Dùng lại ở `view/page.tsx` (read-only) để không lặp logic render Block. */
export function BlockView({ block, projectId, afterHeading = false }: { block: Block; projectId: string; afterHeading?: boolean }) {
  switch (block.type) {
    case "heading": {
      const Tag = HEADING_TAGS[Math.min(6, Math.max(1, block.level)) - 1];
      return <Tag className="font-extrabold text-on-surface mt-3 mb-1 text-body">{block.text}</Tag>;
    }
    case "paragraph":
      return (
        <p className="mb-2 last:mb-0 text-body text-on-surface-dark leading-[1.65]">
          <Runs runs={block.runs} />
        </p>
      );
    case "bullet_list":
      return (
        <ul className="list-disc pl-5 mb-2 space-y-1 text-body leading-[1.65] text-on-surface-dark">
          {block.items.map((item, i) => (
            <li key={i}>
              <Runs runs={item} />
            </li>
          ))}
        </ul>
      );
    case "numbered_list":
      return (
        <ol className="list-decimal pl-5 mb-2 space-y-1 text-body leading-[1.65] text-on-surface-dark">
          {block.items.map((item, i) => (
            <li key={i}>
              <Runs runs={item} />
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className={`ff-scroll overflow-x-auto mb-2 ${afterHeading ? "mt-2" : ""}`}>
          <table className="w-full border-collapse text-body">
            <thead>
              <tr>
                {block.header.map((cell, i) => (
                  <th key={i} className="border border-outline bg-surface-container-low px-2 py-1 text-left font-bold">
                    <Cell cell={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-outline px-2 py-1 align-top">
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
          {block.caption && <span className="text-caption text-on-surface-muted italic">{block.caption}</span>}
        </div>
      );
    case "page_break":
      return <hr className="my-4 border-dashed border-outline" />;
  }
}

/** Mỗi cấp mục con thụt vào thêm bấy nhiêu px (1 → 1.1 → 1.1.1). */
const INDENT_PER_LEVEL = 20;

/** Cấp của section, 0 = mục gốc: theo `level` của BE (1-based), thiếu thì đếm dấu chấm trong số mục. */
const depthOf = (section: RenderedSection): number =>
  Math.max(0, (section.level || (section.number ? section.number.split(".").length : 1)) - 1);

/** Cỡ chữ tiêu đề theo cấp: mục gốc to nhất, mục con nhỏ dần. */
const HEADING_SIZE = ["text-subtitle", "text-heading", "text-body"] as const;
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

/**
 * Mục chưa có nội dung: một dòng chữ nhạt đứng ngay sau tiêu đề, không phải một khối riêng bên dưới. Tài liệu
 * lúc đầu gần như toàn mục rỗng — để mỗi mục chiếm hai dòng thì cả trang thành bức tường chữ nghiêng lặp lại.
 */
function EmptySection({ hint, onSelectStep, mode1 = false }: { hint?: EmptyHint; onSelectStep?: (stepId: string) => void; mode1?: boolean }) {
  if (mode1) return <span className="text-body text-on-surface-muted italic">Mục còn trống — tạo change request (nguồn gap report) để bổ sung.</span>;
  if (!hint) return <span className="text-body text-on-surface-muted italic">Chưa hoàn thiện</span>;
  return (
    <span className={`text-body italic inline-flex items-baseline gap-1.5 flex-wrap ${hint.missing ? "text-error" : "text-on-surface-muted"}`}>
      {hint.missing && <span className="not-italic text-caption font-extrabold px-1.5 py-0.5 rounded-full bg-error text-on-error">Thiếu</span>}
      <span>
        Chưa có nội dung — chạy step {hint.stepId} · {stepLabel(hint.stepId)}
      </span>
      {onSelectStep && (
        <button type="button" onClick={() => onSelectStep(hint.stepId)} className="not-italic text-caption font-bold text-primary hover:underline cursor-pointer">
          Mở step
        </button>
      )}
    </span>
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
  onRedraw,
}: {
  onEdit?: (sectionLabel: string) => void;
  onRedraw?: () => Promise<void>;
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
  // `feature:*` (§3.2…) chỉ là tiêu đề nhóm, Spine feature không có thân — nội dung nằm ở các function con (FLF-248)
  const showEmpty = section.blocks.length === 0 && !section.id.startsWith("feature:");
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
        <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
          <h5 className={`font-bold text-on-surface ${headingSize(depth)}`}>
            {section.number ? `${section.number}. ` : ""}
            {section.heading}
          </h5>
          {showEmpty && <EmptySection hint={emptyHint} onSelectStep={onSelectStep} mode1={mode1} />}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {custom && (
            <span className="text-caption font-extrabold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant" title="Mục ngoài mẫu FPT — giữ nguyên văn từ file upload, sửa qua chat">
              Mục riêng
            </span>
          )}
          {section.awaiting_reaccept && (
            <span className="text-caption font-extrabold px-2 py-0.5 rounded-full bg-accent-gold-soft text-accent-gold-text">Chờ duyệt lại</span>
          )}
          {badge && <span className={`text-caption font-extrabold px-2 py-0.5 rounded-full ${badge.style}`}>{badge.text}</span>}
          {issues && issues.count > 0 && (
            // Chỉ một chấm + số: nội dung vấn đề nằm trong panel, tài liệu giữ để đọc
            <button
              type="button"
              onClick={onOpenIssues}
              title="Xem vấn đề của mục này"
              className={`flex items-center gap-1 text-caption font-bold px-2 py-0.5 rounded-full cursor-pointer ${
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
              className="opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 text-caption font-bold px-2 py-0.5 rounded-full text-primary hover:bg-primary-soft cursor-pointer transition-opacity"
            >
              Sửa mục này
            </button>
          )}
        </div>
      </div>
      {section.blocks.length > 0 && (
        <>
          {section.blocks.map((block, i) => (
            <BlockView key={i} block={block} projectId={projectId} afterHeading={followsHeading(section.blocks, i)} />
          ))}
          {onRedraw && section.blocks.some((b) => b.type === "image") && <RedrawSectionButton onRedraw={onRedraw} />}
        </>
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
  emptyHintOf,
  mode1 = false,
  onEditSection,
  issues,
  onOpenIssues,
  onOpenSectionIssues,
  rewriteError = null,
  onSectionsLoaded,
  headerEnd,
  onRedrawSection,
  hasDiagrams,
  documentLanguage = null,
  onTranslate,
}: DocumentPaneProps) {
  const { document, translation, loading, refreshing, empty, error, reload } = useDocument(projectId, "draft", undefined, refreshToken, documentLanguage);
  const language = shownDocumentLanguage(translation, documentLanguage);
  // Mode 1 không dịch (D3) — dù có truyền nhầm thì cũng không hiện nút
  const translate = mode1 ? undefined : onTranslate;

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
        {/* Tên dài thì cắt "…", nhãn không bao giờ xuống dòng. Pane hẹp ⇒ cắt cả nhãn phiên bản, không tràn đè lên nhóm nút
            bên phải (FLF-265: chip ngôn ngữ làm nhóm phải rộng thêm) */}
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <h3 className="font-bold text-body text-on-surface truncate" title={`SRS — ${projectName}`}>
            SRS — {projectName}
          </h3>
          {document && (
            <span className="shrink-0 whitespace-nowrap text-caption text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full font-mono">{document.version}</span>
          )}
          {document?.watermark && (
            <span className="shrink-0 whitespace-nowrap text-caption font-extrabold px-2 py-0.5 rounded-full bg-accent-gold-soft text-accent-gold-text">{document.watermark}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {issues && onOpenIssues && (
            <button
              type="button"
              onClick={onOpenIssues}
              title="Mở danh sách vấn đề của tài liệu"
              className={`h-8 px-3 flex items-center gap-1.5 whitespace-nowrap rounded-control text-body font-bold cursor-pointer transition-colors ${
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
          {language && <DocumentLanguageChip language={language} compact />}
          {/*
            Tài liệu tự cập nhật sau mỗi bước và mỗi lệnh sửa (BE dựng bản còn thiếu lúc đọc) — nút này chỉ còn để
            kéo về thay đổi đến từ phiên khác, không còn trạng thái "đã cũ" nào để người dùng phải tự xử lý.
          */}
          <button
            type="button"
            onClick={() => void reload()}
            disabled={refreshing}
            title="Tải lại tài liệu"
            className="h-8 px-3 whitespace-nowrap rounded-control text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface text-body font-bold cursor-pointer transition-colors disabled:opacity-60"
          >
            {refreshing ? "Đang làm mới…" : "Làm mới"}
          </button>
          {headerEnd}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto ff-scroll px-8 py-6 space-y-1.5 bg-surface-container-lowest">
        {/* Lỗi nằm trong vùng cuộn: đặt ngay dưới header thì bị lớp mờ của header che */}
        {rewriteError && (
          <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-error">
            Không viết lại được các mục cũ: {rewriteError}
          </p>
        )}
        {/*
          FLF-265: tài liệu khác ngôn ngữ gốc mà còn mục chưa có bản dịch — các mục đó đang in chữ gốc. Nội dung mới đã
          dịch ngay trong lượt AI ghi (D16), nên phần này thường là nội dung có từ trước khi đổi ngôn ngữ dự án.
        */}
        {translation && translation.missing > 0 && (
          <div role="status" className="rounded-control bg-accent-gold-soft border border-accent-gold-border px-3 py-2 text-body text-accent-gold-text flex items-center gap-1.5 flex-wrap">
            <Icon name="translate" size={14} />
            <span title="Các mục này đang hiện chữ gốc cho tới khi được dịch">{translation.missing} mục chưa dịch</span>
            {translate && (
              <>
                <span aria-hidden>·</span>
                <button type="button" onClick={translate} className="font-bold hover:underline cursor-pointer">
                  Dịch tài liệu
                </button>
              </>
            )}
          </div>
        )}
        {loading && <div className="text-body text-on-surface-muted italic">Đang tải tài liệu…</div>}

        {/* Dự án chưa chạy bước nào: nói tài liệu sẽ tự hiện, không mời bấm gì — không có việc nào cho người dùng ở đây */}
        {empty && <div className="text-body text-on-surface-muted italic">Tài liệu sẽ hiện ở đây ngay khi các bước đầu tiên chạy xong.</div>}

        {!empty && error && (
          <div className="bg-error-container rounded-card p-3.5 text-body text-on-error-container">
            Không tải được tài liệu: {error}
          </div>
        )}

        {document &&
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
              onRedraw={onRedrawSection && hasDiagrams?.(section.id) ? () => onRedrawSection(section.id) : undefined}
            />
          ))}
      </div>
    </section>
  );
}
