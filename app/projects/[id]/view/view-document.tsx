"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import { BlockView, depthOf, followsHeading, headingSize, sectionLabel } from "../_components/DocumentPane";
import type { Block, RenderedDocument, RenderedSection, RocRow } from "@/types/document";
import type { DocumentLanguage } from "@/types/project";

/**
 * Chữ của bảng Record of Changes theo **ngôn ngữ tài liệu** (không theo ngôn ngữ giao diện) — khớp `WRITER_TEXT` của BE
 * (`render/labels.ts`): tiêu đề, cột, chú thích như bản Word.
 */
const ROC_TEXT: Readonly<Record<DocumentLanguage, { title: string; header: string[]; legend: string }>> = {
  en: { title: "I. Record of Changes", header: ["Date", "Version", "A*, M, D", "In charge", "Change Description"], legend: "*A - Added, M - Modified, D - Deleted" },
  vi: { title: "I. Lịch sử thay đổi", header: ["Ngày", "Phiên bản", "A*, M, D", "Người thực hiện", "Mô tả thay đổi"], legend: "*A - Thêm, M - Sửa, D - Xoá" },
};

/** Khoá section §I Record of Changes (BE `section-registry`). */
const ROC_SECTION_ID = "fixed:I";

const recordOfChangesBlock = (rows: readonly RocRow[], language: DocumentLanguage): Block => ({
  type: "table",
  header: ROC_TEXT[language].header.map((text) => [{ text }]),
  rows: rows.map((r) => [r.date, r.version, r.change_type, r.in_charge, r.description].map((text) => [{ text }])),
});

/** Khoá của một chỗ ghim: `section_id` hoặc `section_id#block`. Dùng chung cho đếm, đánh dấu và cuộn tới. */
export const pinKey = (sectionId: string, blockIndex: number | null): string => (blockIndex === null ? sectionId : `${sectionId}#${blockIndex}`);

/** id DOM của chỗ ghim để cuộn tới (`id` của section có `:` vẫn hợp lệ với `getElementById`). */
export const pinDomId = (key: string): string => `pin-${key}`;

interface ViewDocumentProps {
  doc: RenderedDocument;
  projectId: string;
  /** Ngôn ngữ tài liệu — chữ bảng Record of Changes theo nó. */
  language: DocumentLanguage;
  isIncomplete: (section: RenderedSection) => boolean;
  /** Số comment của tab đang mở theo `pinKey`. */
  pinCounts: ReadonlyMap<string, number>;
  canComment: boolean;
  /** Chỗ đang soạn comment / đang lọc / vừa được trỏ tới từ panel — nền đậm hơn để biết comment nói về đâu. */
  activeKeys: ReadonlySet<string>;
  onStartComment: (section: RenderedSection, blockIndex: number | null) => void;
  onShowComments: (sectionId: string, blockIndex: number | null) => void;
}

/**
 * Thân tài liệu chỉ đọc (UC 1.14): chảy liền như bản xuất, không hộp cho từng mục. Mỗi mục / đoạn có cột lề phải chứa
 * số comment và nút ghim — nút ghim không chỉ hiện khi rê chuột: trên cảm ứng luôn hiện, bằng phím thì Tab tới là thấy.
 */
export default function ViewDocument({
  doc,
  projectId,
  language,
  isIncomplete,
  pinCounts,
  canComment,
  activeKeys,
  onStartComment,
  onShowComments,
}: ViewDocumentProps) {
  const t = useTranslations("workspace.view");

  /** Lề phải của một chỗ ghim: chip số comment (bấm để lọc panel) + nút ghim. Hàm thường, không phải component con. */
  const gutter = (section: RenderedSection, blockIndex: number | null) => {
    const count = pinCounts.get(pinKey(section.id, blockIndex)) ?? 0;
    return (
      <div className="w-10 lg:w-9 shrink-0 flex flex-col items-center gap-1 pt-0.5">
        {count > 0 && (
          <button
            type="button"
            onClick={() => onShowComments(section.id, blockIndex)}
            aria-label={t("viewComments", { count })}
            title={t("viewComments", { count })}
            // Nền đặc: dòng có comment / đang được nói tới đã tô tím nhạt, chip nhạt sẽ chìm vào nền dòng
            className="inline-flex items-center justify-center gap-0.5 min-w-10 h-10 lg:min-w-9 lg:h-7 px-1.5 rounded-full bg-primary text-on-primary text-caption font-bold tabular-nums cursor-pointer hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Icon name="feedback" size={12} />
            {count}
          </button>
        )}
        {canComment && (
          <button
            type="button"
            onClick={() => onStartComment(section, blockIndex)}
            aria-label={
              blockIndex === null
                ? t("commentSection", { section: sectionLabel(section) })
                : t("commentBlock", { index: blockIndex + 1, section: sectionLabel(section) })
            }
            title={t("pinTitle")}
            // Thiết bị có chuột: mờ, hiện khi rê vào mục / đoạn hoặc khi focus. Cảm ứng (không hover): luôn hiện.
            className="inline-flex items-center justify-center size-10 lg:size-8 rounded-control text-on-surface-muted hover:text-primary hover:bg-primary-soft cursor-pointer transition-[opacity,color,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/pin:opacity-100 [@media(hover:hover)]:group-focus-within/pin:opacity-100"
          >
            <Icon name="comment-add" size={16} />
          </button>
        )}
      </div>
    );
  };

  /** Nền của chỗ ghim: đang được nói tới (soạn / lọc / trỏ tới) > có comment > không. */
  const tone = (key: string): string =>
    activeKeys.has(key) ? "bg-primary-fixed" : (pinCounts.get(key) ?? 0) > 0 ? "bg-primary-soft" : "";

  // FLF-411 (#13): bảng "I. Record of Changes" là một phần của tài liệu (bản Word in ở đầu) — màn Xem in như bản xuất.
  // Mẫu của file có heading Record of Changes thành mục riêng (`fixed:I`) ⇒ bảng in trong mục đó, không in hai lần.
  const roc = doc.recordOfChanges ?? [];
  const rocBlock = roc.length > 0 ? recordOfChangesBlock(roc, language) : null;
  const rocOwnSection = doc.sections.some((x) => x.id === ROC_SECTION_ID);

  return (
    <div className="flex flex-col gap-1">
      {rocBlock && !rocOwnSection && (
        <article aria-label={ROC_TEXT[language].title} className="flex flex-col gap-1 pb-2">
          <h3 className={`min-h-8 flex items-center font-bold text-on-surface ${headingSize(1)}`}>{ROC_TEXT[language].title}</h3>
          <div className="overflow-x-auto ff-scroll">
            <BlockView block={rocBlock} projectId={projectId} afterHeading />
          </div>
          <p className="text-caption text-on-surface-subtle italic">{ROC_TEXT[language].legend}</p>
        </article>
      )}
      {doc.sections.map((rawSection) => {
        const section = rocBlock && rawSection.id === ROC_SECTION_ID ? { ...rawSection, blocks: [rocBlock] } : rawSection;
        const depth = depthOf(section);
        const heading = (
          <>
            {section.number ? `${section.number}. ` : ""}
            {section.heading}
          </>
        );
        const sectionKey = pinKey(section.id, null);
        // Heading nhóm: chỉ là tiêu đề chương / mục cha, không có nội dung riêng (cùng cách workspace hiển thị) — không
        // "chưa hoàn thiện", nhưng vẫn ghim comment được như mọi mục
        if (section.id.startsWith("group:") && section.blocks.length === 0 && !isIncomplete(section)) {
          return (
            <div key={section.id} className="pt-6 first:pt-0">
              <Pinnable id={pinDomId(sectionKey)} tone={tone(sectionKey)} gutter={gutter(section, null)}>
                <h2 className={`min-h-8 flex items-center font-extrabold text-on-surface ${headingSize(depth)}`}>{heading}</h2>
              </Pinnable>
            </div>
          );
        }
        const incomplete = section === rawSection && (isIncomplete(section) || section.blocks.length === 0);
        return (
          <article key={section.id} aria-label={sectionLabel(section)} className="pt-4 first:pt-0 flex flex-col gap-1">
            <Pinnable id={pinDomId(sectionKey)} tone={tone(sectionKey)} gutter={gutter(section, null)}>
              <div className="flex items-center gap-2 flex-wrap min-h-8">
                <h3 className={`font-bold text-on-surface ${headingSize(depth)}`}>{heading}</h3>
                {incomplete && (
                  <Badge tone="neutral">
                    <Icon name="clock" size={11} />
                    {t("incomplete")}
                  </Badge>
                )}
              </div>
            </Pinnable>
            {!incomplete &&
              section.blocks.map((block, i) => {
                const key = pinKey(section.id, i);
                return (
                  <Pinnable key={i} id={pinDomId(key)} tone={tone(key)} gutter={gutter(section, i)}>
                    {/* Bảng rộng cuộn ngang trong khối của nó, trang không tràn ngang */}
                    <div className="overflow-x-auto ff-scroll">
                      <BlockView block={block} projectId={projectId} afterHeading={followsHeading(section.blocks, i)} />
                    </div>
                  </Pinnable>
                );
              })}
          </article>
        );
      })}
    </div>
  );
}

/** Một chỗ ghim được: nội dung + cột lề phải; nền đổi theo trạng thái comment, không viền. */
function Pinnable({ id, tone, gutter, children }: { id: string; tone: string; gutter: ReactNode; children: ReactNode }) {
  return (
    <div id={id} className={`group/pin scroll-my-24 flex items-start gap-2 -mx-2 sm:-mx-3 pl-2 sm:pl-3 pr-1 py-1 rounded-inner transition-colors duration-300 ${tone}`}>
      <div className="flex-1 min-w-0">{children}</div>
      {gutter}
    </div>
  );
}

/** Giữ chỗ khi tải tài liệu: dáng của trang tài liệu (tiêu đề + vài dòng), không phải một dòng chữ. */
export function ViewDocumentSkeleton() {
  const t = useTranslations("workspace.view");
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-8">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      ))}
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}

/** Không tải được tài liệu: câu lỗi + thử lại đúng phiên bản đang chọn. */
export function ViewDocumentError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations("workspace.view");
  return (
    <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 bg-error-container text-on-error-container rounded-card px-4 py-3.5">
      <Icon name="error-circle" size={18} className="shrink-0 text-error" />
      <p className="flex-1 text-body font-medium">{message}</p>
      <Button size="sm" variant="secondary" icon="refresh" onClick={onRetry} className="self-start sm:self-auto max-sm:h-10">
        {t("retry")}
      </Button>
    </div>
  );
}
