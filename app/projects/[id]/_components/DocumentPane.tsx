"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { ApiClientError } from "@/lib/api/client";
import { fetchDocumentImage, IMAGE_CHANGED, MEDIA_NOT_EMBEDDABLE, parseImageRef } from "@/lib/api/document-images";
import { fetchDiagramPng } from "@/lib/api/spine";
import { tStep } from "@/lib/i18n";
import { hookErrorText } from "@/lib/hook-errors";
import { shownDocumentLanguage } from "@/lib/document-language";
import { blockHasRealText } from "@/lib/instruction-text";
import { useDocument, type DocumentUpdate, type UseDocumentResult } from "../hooks/useDocument";
import DocumentLanguageChip from "./DocumentLanguageChip";
import DocumentUpdatePill from "./DocumentUpdatePill";
import { blockRegionKey, sectionRegionKey } from "./document-diff";
import type { Block, InlineRun, RenderedSection, SectionStatus, TableCell } from "@/types/document";
import type { Flag } from "@/types/flags";
import type { DocumentLanguage } from "@/types/project";
import { userErrorMessage } from "@/lib/api/error-messages";

interface DocumentPaneProps {
  projectId: string;
  projectName?: string;
  /** Cờ mở, dùng để gắn nút "xem tại step" theo `section_id` (nguồn duy nhất đáng tin cho map này). */
  flags?: Flag[];
  /**
   * Trạng thái tài liệu do chủ của `useDocument` (trang workspace) giữ — một instance duy nhất, nên cũng thấy được lúc tài
   * liệu mới về để đánh dấu mục đang / vừa cập nhật. Không truyền ⇒ pane tự tải bằng `refreshToken` + `documentLanguage`.
   */
  doc?: UseDocumentResult;
  onSelectStep?: (stepId: string) => void;
  /** Chỉ dùng khi không truyền `doc`: tăng để buộc tải lại tài liệu. */
  refreshToken?: number;
  /**
   * Mode 1 v2 (FLF-185): step sở hữu section chưa có nội dung — hiện "Chưa có nội dung — chạy step X" thay câu chung.
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
   * FLF-278: "Nhờ AI soạn" trên mục riêng còn trống của mẫu bắt buộc (`custom:*`) — điền sẵn lệnh soạn nháp vào ô chat, BA tự
   * gửi; trước baseline ra bản xem trước, sau baseline thành change request như mọi lệnh sửa. Không truyền ⇒ không có nút.
   */
  onDraftSection?: (sectionLabel: string) => void;
  /**
   * Dự án theo mẫu cố định (mẫu bắt buộc lẫn mẫu công ty của dự án có sẵn): mục riêng là **mục của mẫu**, không phải mục
   * ngoài mẫu FlintFlow; "Nhờ AI soạn" có ở mọi mục mẫu còn trống, không chỉ `custom:*`.
   */
  requiredTemplate?: boolean;
  /**
   * FLF-278 — thư viện nội dung của tổ chức. `libraryMatchOf`: mục riêng có nội dung cùng tiêu đề trong thư viện;
   * `onUseLibrary` mở bản xem trước / lệnh sửa (không ghi ngay); `onSaveToLibrary` lưu mục đã viết vào thư viện;
   * `onUseLibraryAll` dùng cho mọi mục trống có gợi ý.
   */
  libraryMatchOf?: (sectionId: string) => { empty: boolean } | undefined;
  onUseLibrary?: (sectionId: string) => void;
  onSaveToLibrary?: (sectionId: string) => void;
  libraryEmptyCount?: number;
  onUseLibraryAll?: () => void;
  /**
   * "Góp ý" trên từng mục (UC-49): ghim lời nhắn vào mục, **không** đổi nội dung (BR-05) nên vẫn giữ
   * nguyên tắc document pane read-only. Không truyền ⇒ không có nút (trang xem, mode 1).
   */
  onCommentSection?: (anchor: { sectionId: string; label: string }) => void;
  /** Số góp ý đang mở của một mục — vẽ chấm số trên header mục, bấm mở panel Góp ý. */
  commentCountOf?: (sectionId: string) => number;
  onOpenSectionComments?: (sectionId: string) => void;
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
   * Nút "Thử lại" trong khung sơ đồ vẽ lỗi (BE gửi `png = "diagram-error:<id>"`). Không truyền ⇒ khung chỉ báo lỗi,
   * không có nút (mode 1, Viewer).
   */
  onRedrawDiagram?: (diagramId: string) => Promise<void>;
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
  /**
   * Có bản tài liệu mới hơn bản đang hiển thị nhưng user đang thao tác dở nên chưa tự thay nội dung: hiện dải
   * "Có bản mới · Cập nhật" ở đầu tài liệu. Không truyền ⇒ không có dải.
   */
  newerVersion?: { onApply: () => void } | null;
}

/** "Vẽ lại sơ đồ" của một mục: vẽ lại bằng code hiện tại dù dữ liệu không đổi (vd đổi kiểu đường ERD). */
function RedrawSectionButton({ onRedraw }: { onRedraw: () => Promise<void> }) {
  const t = useTranslations("workspace.document");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redraw = async () => {
    setBusy(true);
    setError(null);
    try {
      await onRedraw();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("redrawFailed"));
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
        title={t("redrawTitle")}
        className="inline-flex items-center gap-1 text-caption font-bold px-2 py-0.5 rounded-full text-primary hover:bg-primary-soft cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Icon name="refresh" size={11} />
        {busy ? t("redrawing") : t("redraw")}
      </button>
      {error && <span className="text-caption text-error">{error}</span>}
    </div>
  );
}

/** Nhãn đọc được của một mục: `§2.2.2 Actors`. */
export const sectionLabel = (section: Pick<RenderedSection, "number" | "heading">): string =>
  `§${section.number ? `${section.number} ` : ""}${section.heading}`;

/** Key React của từng mục: `id`, lần lặp thứ n của cùng `id` ⇒ `id#n` (không trùng key, mục không lặp giữ key cũ). */
export const sectionRenderKeys = (sections: readonly Pick<RenderedSection, "id">[]): string[] => {
  const seen = new Map<string, number>();
  return sections.map(({ id }) => {
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    return n === 0 ? id : `${id}#${n}`;
  });
};

export interface EmptyHint {
  stepId: string;
}

/** Chữ của nhãn: `workspace.document.status.<status>`. */
const STATUS_BADGE: Record<SectionStatus, { style: string } | null> = {
  accepted: { style: "bg-success-soft text-success" },
  // `draft` là trạng thái mặc định của mọi mục chưa chốt: gắn nhãn cho tất cả thì nhãn thành nhiễu, không thành tin
  draft: null,
  stale: { style: "bg-accent-gold-soft text-accent-gold-text" },
  derived: { style: "bg-surface-container-high text-on-surface-variant" },
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

/**
 * Báo "ảnh đã vẽ lại sau khi tài liệu dựng" (`409 IMAGE_CHANGED`) cho chủ của tài liệu để tải lại — truyền qua context vì
 * ảnh nằm sâu trong mục → block. Ngoài `DocumentPane` (không có Provider) thì không có gì để gọi.
 */
const ImageChangedContext = createContext<(() => void) | null>(null);

/** Hai lượt tải lại vì `IMAGE_CHANGED` cách nhau tối thiểu chừng này — chặn vòng lặp nếu BE vẫn lệch hash. */
const IMAGE_RELOAD_MIN_GAP_MS = 10_000;

/** Vùng giữ chỗ khi ảnh đang tải: chiều cao cố định để chữ bên dưới không nhảy khi ảnh về. */
const IMAGE_PLACEHOLDER_CLASS = "w-full min-h-[240px] grid place-items-center rounded-inner bg-surface-container text-caption text-on-surface-subtle italic";

/**
 * Ảnh trong tài liệu, ba dạng `png`:
 * - base64 thật (ảnh giữ chỗ, BE cũ, export): hiện thẳng;
 * - `image-ref:<kind>:<id>[:<locale>]@<hash>`: tải Blob qua `lib/api` (Blob nhớ theo token, ảnh đã có không tải lại), mỗi lần
 *   mount tạo object URL riêng và thu hồi khi gỡ / đổi token;
 * - `diagram-ref:<id>` (dạng cũ): tải PNG của sơ đồ.
 */
function DocumentImage({ projectId, png, caption }: { projectId: string; png: string; caption?: string }) {
  const t = useTranslations("workspace.document");
  const loadFailed = t("diagramLoadFailed");
  const mediaLoadFailed = t("mediaLoadFailed");
  const onImageChanged = useContext(ImageChangedContext);
  const onImageChangedRef = useRef(onImageChanged);
  useEffect(() => {
    onImageChangedRef.current = onImageChanged;
  }, [onImageChanged]);
  const imageRef = parseImageRef(png);
  const isImageRef = imageRef !== null;
  const isMediaRef = imageRef?.kind === "media";
  const isDiagramRef = png.startsWith("diagram-ref:");
  const loadsRemotely = isImageRef || isDiagramRef;
  const directSrc = loadsRemotely ? null : `data:image/png;base64,${png}`;
  // Gắn kết quả với token đã tải: đổi `png` thì kết quả cũ (URL đã thu hồi) không bị dùng nhầm cho ảnh mới
  const [resolved, setResolved] = useState<{ png: string; url: string } | null>(null);
  const [failure, setFailure] = useState<{ png: string; message: string } | null>(null);
  // Ảnh gốc mode 1 mà BE xác nhận không phải PNG/JPEG (`415`) ⇒ khung giữ chỗ + chú thích, không phải lỗi
  const [notEmbedded, setNotEmbedded] = useState<string | null>(null);
  // Bấm "Thử lại" ở ảnh gốc lỗi (404 / 503 / mạng) ⇒ tăng để effect tải lại; lượt lỗi không bị cache ở `lib/api`
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!loadsRemotely) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const load = isImageRef
      ? fetchDocumentImage(projectId, png).then((blob) => URL.createObjectURL(blob))
      : fetchDiagramPng(projectId, png.slice("diagram-ref:".length));
    load
      .then((url) => {
        // Unmount (hoặc đổi `png`) trước khi tải xong: URL vừa tạo không còn ai thu hồi ở cleanup — thu hồi ngay tại đây.
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setResolved({ png, url });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Ảnh đã vẽ lại: tải lại tài liệu để có tham chiếu mới, trong lúc đó vẫn giữ khung chờ thay vì báo lỗi
        if (isImageRef && err instanceof ApiClientError && err.code === IMAGE_CHANGED && onImageChangedRef.current) {
          onImageChangedRef.current();
          return;
        }
        // Chỉ khi BE xác nhận sai định dạng mới nói "định dạng không hỗ trợ" — lỗi khác không đoán lý do
        if (isMediaRef && err instanceof ApiClientError && (err.status === 415 || err.code === MEDIA_NOT_EMBEDDABLE)) {
          setNotEmbedded(png);
          return;
        }
        // Ảnh gốc lỗi vì lý do khác (không còn trong tài liệu, storage tạm hỏng, mạng): câu trung tính + nút thử lại
        setFailure({ png, message: isMediaRef ? mediaLoadFailed : userErrorMessage(err, loadFailed) });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `loadFailed` / `mediaLoadFailed` chỉ là câu hiển thị — đổi ngôn ngữ không cần tải lại ảnh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, png, isImageRef, isMediaRef, loadsRemotely, attempt]);

  const src = directSrc ?? (resolved?.png === png ? resolved.url : null);
  const error = failure?.png === png ? failure.message : null;
  if (notEmbedded === png) return <div className={IMAGE_PLACEHOLDER_CLASS}>{t("mediaNotEmbedded")}</div>;
  if (error && isMediaRef) {
    return (
      <div className={IMAGE_PLACEHOLDER_CLASS}>
        <div className="flex flex-col items-center gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setFailure(null);
              setAttempt((n) => n + 1);
            }}
            className="not-italic text-primary hover:underline"
          >
            {t("retryDiagram")}
          </button>
        </div>
      </div>
    );
  }
  if (error) return <div className="text-caption text-error italic">{error}</div>;
  if (!src) return <div className={IMAGE_PLACEHOLDER_CLASS}>{t("imageLoading")}</div>;
  // eslint-disable-next-line @next/next/no-img-element -- ảnh render server-side (base64/blob), không phải asset tĩnh Next
  return <img src={src} alt={caption ?? t("imageAlt")} className="max-w-full rounded-inner" />;
}

/** Ô `png` của sơ đồ vẽ lỗi — BE giữ chỗ hình bằng `diagram-error:<id>` thay vì bỏ hình khỏi mục. */
const DIAGRAM_ERROR_PREFIX = "diagram-error:";

/** Khung thay cho sơ đồ vẽ lỗi, ngay tại chỗ hình: báo chưa vẽ được + nút thử lại vẽ đúng sơ đồ đó. */
function DiagramErrorBox({ diagramId, onRetry }: { diagramId: string; onRetry?: (diagramId: string) => Promise<void> }) {
  const t = useTranslations("workspace.document");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retry = async () => {
    if (!onRetry) return;
    setBusy(true);
    setError(null);
    try {
      await onRetry(diagramId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("redrawFailed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      role="group"
      aria-label={t("diagramNotDrawn")}
      className="w-full max-w-md aspect-[4/3] flex flex-col items-center justify-center gap-3 p-6 rounded-inner bg-surface-container text-center"
    >
      <Icon name="warning" size={24} className="text-error" />
      <span className="text-body font-bold text-on-surface">{t("diagramNotDrawn")}</span>
      <span className="text-caption text-on-surface-muted">{onRetry ? t("diagramNotDrawnHint") : t("diagramNotDrawnReadOnly")}</span>
      {onRetry && (
        <button
          type="button"
          onClick={() => void retry()}
          disabled={busy}
          className="inline-flex items-center gap-1 text-caption font-bold px-3 py-1 rounded-full bg-primary text-on-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="refresh" size={11} />
          {busy ? t("redrawing") : t("retryDiagram")}
        </button>
      )}
      {error && <span className="text-caption text-error">{error}</span>}
    </div>
  );
}

/** Trạng thái hiển thị của một vùng (mục / block) so với lượt cập nhật tài liệu — xem `.ff-upd` ở `globals.css`. */
type UpdateState = "pending" | "fresh" | "settled" | null;

/** Vùng "vừa cập nhật" giữ nền cho tới khi vào khung nhìn chừng này rồi mới nhạt dần. */
export const FRESH_HOLD_MS = 2000;

interface RegionProgress {
  seq: number;
  /** Observer đã báo ít nhất một lượt — trước đó chưa biết vùng nào đang ngoài màn hình nên chưa dựng nhãn nổi. */
  observed: boolean;
  /** Vùng đã từng vào khung nhìn. */
  seen: ReadonlySet<string>;
  /** Vùng đã ở trong khung nhìn đủ `FRESH_HOLD_MS` ⇒ nền nhạt dần. */
  settled: ReadonlySet<string>;
}

const NO_PROGRESS: RegionProgress = { seq: 0, observed: false, seen: new Set(), settled: new Set() };

/**
 * Theo dõi các vùng vừa đổi của lượt cập nhật `update`: vùng nào đã vào khung nhìn (bắt đầu đếm `FRESH_HOLD_MS` để nhạt dần,
 * rời đi trước khi đủ thì đếm lại) và vùng nào chưa ai nhìn thấy (nhãn nổi "N mục vừa cập nhật"). Một observer cho cả lượt.
 */
function useUpdateRegions(scrollRef: { current: HTMLElement | null }, update: DocumentUpdate | null) {
  const [progress, setProgress] = useState<RegionProgress>(NO_PROGRESS);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !update || update.regions.length === 0) return;
    const seq = update.seq;
    const wanted = new Set(update.regions);
    const elements = new Map<string, Element>();
    root.querySelectorAll<HTMLElement>("[data-update-region]").forEach((el) => {
      const key = el.dataset.updateRegion;
      if (key && wanted.has(key)) elements.set(key, el);
    });
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const add = (field: "seen" | "settled", key: string) =>
      setProgress((prev) => {
        const base = prev.seq === seq ? prev : { ...NO_PROGRESS, seq };
        if (base[field].has(key)) return base;
        return { ...base, [field]: new Set(base[field]).add(key) };
      });
    const visible = (key: string) => {
      add("seen", key);
      if (!timers.has(key)) timers.set(key, setTimeout(() => add("settled", key), FRESH_HOLD_MS));
    };
    const hidden = (key: string) => {
      const timer = timers.get(key);
      if (timer) clearTimeout(timer);
      timers.delete(key);
    };
    const observed = () =>
      setProgress((prev) => (prev.seq === seq ? (prev.observed ? prev : { ...prev, observed: true }) : { ...NO_PROGRESS, seq, observed: true }));

    if (typeof IntersectionObserver === "undefined") {
      // Môi trường không có observer: coi mọi vùng là đang thấy (không dựng nhãn nổi nhầm)
      queueMicrotask(() => {
        elements.forEach((_, key) => visible(key));
        observed();
      });
      return () => timers.forEach((timer) => clearTimeout(timer));
    }
    const keyOf = new Map([...elements].map(([key, el]) => [el, key]));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = keyOf.get(entry.target);
          if (!key) continue;
          if (entry.isIntersecting) visible(key);
          else hidden(key);
        }
        observed();
      },
      { root }
    );
    elements.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [scrollRef, update]);

  return update && progress.seq === update.seq ? progress : NO_PROGRESS;
}

/** Bao một block của mục để đánh dấu riêng đoạn vừa đổi mà không đổi bố cục (xem `.ff-upd`). */
function BlockSlot({ regionKey, state, spaced, children }: { regionKey: string; state: UpdateState; spaced: boolean; children: ReactNode }) {
  // `p` trong BlockView tự bỏ lề dưới vì là con cuối — bọc lại thì nó luôn là con cuối nên bù lề ở đây
  return (
    <div data-update-region={regionKey} data-update={state ?? undefined} className={`ff-upd flow-root ${spaced ? "mb-2" : ""}`}>
      {children}
    </div>
  );
}

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

/** Bảng đứng ngay dưới tiêu đề (tiêu đề section hoặc heading con) — cần khoảng trống để không dính sát tiêu đề. */
export const followsHeading = (blocks: Block[], index: number): boolean => index === 0 || blocks[index - 1]?.type === "heading";

/** Dùng lại ở `view/page.tsx` (read-only) để không lặp logic render Block. */
export function BlockView({
  block,
  projectId,
  afterHeading = false,
  onRedrawDiagram,
}: {
  block: Block;
  projectId: string;
  afterHeading?: boolean;
  onRedrawDiagram?: (diagramId: string) => Promise<void>;
}) {
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
          {block.png.startsWith(DIAGRAM_ERROR_PREFIX) ? (
            <DiagramErrorBox diagramId={block.png.slice(DIAGRAM_ERROR_PREFIX.length)} onRetry={onRedrawDiagram} />
          ) : (
            <DocumentImage projectId={projectId} png={block.png} caption={block.caption} />
          )}
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
  const t = useTranslations("workspace.document");
  const locale = useLocale();
  if (mode1) return <span className="text-body text-on-surface-muted italic">{t("emptyMode1")}</span>;
  if (!hint) return <span className="text-body text-on-surface-muted italic">{t("incompleteShort")}</span>;
  return (
    <span className="text-body italic inline-flex items-baseline gap-1.5 flex-wrap text-on-surface-muted">
      <span>{t("emptyRunStep", { stepId: hint.stepId, label: tStep(hint.stepId, locale) })}</span>
      {onSelectStep && (
        <button type="button" onClick={() => onSelectStep(hint.stepId)} className="not-italic text-caption font-bold text-primary hover:underline cursor-pointer">
          {t("openStep")}
        </button>
      )}
    </span>
  );
}

function SectionView({
  section,
  hasChildren = false,
  projectId,
  issues,
  onOpenIssues,
  pending,
  regionState,
  onSelectStep,
  emptyHint,
  mode1 = false,
  requiredTemplate = false,
  onEdit,
  onDraft,
  libraryMatch,
  onUseLibrary,
  onSaveToLibrary,
  onComment,
  commentCount = 0,
  onOpenComments,
  onRedraw,
  onRedrawDiagram,
}: {
  onEdit?: (sectionLabel: string) => void;
  onDraft?: (sectionLabel: string) => void;
  libraryMatch?: { empty: boolean };
  onUseLibrary?: () => void;
  onSaveToLibrary?: () => void;
  onComment?: (sectionLabel: string) => void;
  /** Số góp ý đang mở của mục này. */
  commentCount?: number;
  onOpenComments?: () => void;
  onRedraw?: () => Promise<void>;
  onRedrawDiagram?: (diagramId: string) => Promise<void>;
  section: RenderedSection;
  /** Mục ngay sau sâu hơn — mục riêng trống mà có mục con là heading bao của mẫu, không cần soạn. */
  hasChildren?: boolean;
  projectId: string;
  /** Vấn đề đang mở của mục: số lượng và có cái nào chặn chốt bản không. */
  issues?: { count: number; blocking: boolean };
  onOpenIssues?: () => void;
  /** Mục đang chờ bản mới (thao tác của chính tab đang ghi). */
  pending: boolean;
  /** Trạng thái của một vùng vừa đổi theo khoá `sectionRegionKey` / `blockRegionKey`. */
  regionState: (regionKey: string) => UpdateState;
  onSelectStep?: (stepId: string) => void;
  emptyHint?: EmptyHint;
  mode1?: boolean;
  requiredTemplate?: boolean;
}) {
  // Hook gọi trước mọi `return` sớm (rules-of-hooks)
  const t = useTranslations("workspace.document");
  if (section.id.startsWith("group:")) return <GroupHeading section={section} />;
  const badge = section.status && !mode1 ? STATUS_BADGE[section.status] : null;
  // `feature:*` (§3.2…) chỉ là tiêu đề nhóm, Spine feature không có thân — nội dung nằm ở các function con (FLF-248)
  const showEmpty = section.blocks.length === 0 && !section.id.startsWith("feature:");
  const custom = section.id.startsWith("custom:");
  // Mục riêng của mẫu chỉ có chữ hướng dẫn (`[Describe …]`) vẫn là mục trống — như BE (cờ mục mẫu, thư viện tổ chức)
  const customEmpty = custom && !section.blocks.some(blockHasRealText);
  // Mẫu cố định: mọi mục của mẫu còn trống (kể cả mục map vào mục FlintFlow) đều mời soạn
  const templateEmpty = requiredTemplate ? showEmpty || !section.blocks.some(blockHasRealText) : customEmpty
  const depth = depthOf(section);
  const updateState: UpdateState = pending ? "pending" : regionState(sectionRegionKey(section.id));
  return (
    <article
      data-section-id={section.id}
      data-update-region={sectionRegionKey(section.id)}
      data-update={updateState ?? undefined}
      aria-busy={updateState === "pending" || undefined}
      // Mục con thụt vào so với mục cha (inline style: độ sâu là dữ liệu, không phải class tĩnh); −12px bù phần đệm
      // ngang dành cho nền nổi bật, để chữ của mục gốc thẳng hàng với heading nhóm
      style={{ marginLeft: depth * INDENT_PER_LEVEL - 12 }}
      // Không khung/viền: tài liệu đọc liền mạch như bản xuất. Mục đang / vừa cập nhật nổi lên bằng nền tím nhạt + vạch
      // trái (`.ff-upd`, globals.css) — chỉ là hiển thị, không liên quan dữ liệu hay file xuất.
      className="ff-upd ff-upd-section group/section -mr-3 px-3 py-1.5 rounded-control flex flex-col gap-1.5"
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
            <span className="text-caption font-extrabold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant" title={requiredTemplate ? t("templateSectionTitle") : t("customTitle")}>
              {requiredTemplate ? t("templateSection") : t("custom")}
            </span>
          )}
          {section.awaiting_reaccept && (
            <span className="text-caption font-extrabold px-2 py-0.5 rounded-full bg-accent-gold-soft text-accent-gold-text">{t("awaitingReaccept")}</span>
          )}
          {badge && section.status && (
            <span className={`text-caption font-extrabold px-2 py-0.5 rounded-full ${badge.style}`}>{t(`status.${section.status}`)}</span>
          )}
          {issues && issues.count > 0 && (
            // Chỉ một chấm + số: nội dung vấn đề nằm trong panel, tài liệu giữ để đọc
            <button
              type="button"
              onClick={onOpenIssues}
              title={t("issuesTitle")}
              aria-label={t("issuesAria", { count: issues.count })}
              className={`flex items-center gap-1 text-caption font-bold px-2 py-0.5 rounded-full cursor-pointer ${
                issues.blocking ? "bg-error-container text-error" : "bg-accent-gold-soft text-accent-gold-text"
              }`}
            >
              <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${issues.blocking ? "bg-error" : "bg-accent-gold"}`} />
              {issues.count}
            </button>
          )}
          {commentCount > 0 && (
            // Tông trung tính để không lẫn với chấm cờ đỏ/vàng ngay bên cạnh
            <button
              type="button"
              onClick={onOpenComments}
              disabled={!onOpenComments}
              title={t("commentsTitle")}
              className="flex items-center gap-1 text-caption font-bold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant enabled:cursor-pointer disabled:cursor-default"
            >
              <Icon name="feedback" size={11} />
              {commentCount}
            </button>
          )}
          {onComment && (
            // Ghim góp ý vào đúng mục đang đọc. Không đổi nội dung (BR-05) — document pane vẫn read-only
            <button
              type="button"
              onClick={() => onComment(sectionLabel(section))}
              className="opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 text-caption font-bold px-2 py-0.5 rounded-full text-primary hover:bg-primary-soft cursor-pointer transition-opacity"
            >
              {t("comment")}
            </button>
          )}
          {onUseLibrary && custom && libraryMatch?.empty && (
            // Thư viện tổ chức có nội dung cùng tiêu đề: mở bản xem trước, chỉ ghi khi BA xác nhận
            <button
              type="button"
              onClick={onUseLibrary}
              className="text-caption font-bold px-2 py-0.5 rounded-full text-primary hover:bg-primary-soft cursor-pointer"
            >
              {t("useLibrary")}
            </button>
          )}
          {onSaveToLibrary && custom && !customEmpty && (
            <button
              type="button"
              onClick={onSaveToLibrary}
              title={t("saveToLibraryTitle")}
              className="opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 text-caption font-bold px-2 py-0.5 rounded-full text-primary hover:bg-primary-soft cursor-pointer transition-opacity"
            >
              {t("saveToLibrary")}
            </button>
          )}
          {onDraft && templateEmpty && !hasChildren && !section.id.startsWith("feature:") && (
            // Mục riêng của mẫu còn trống: luôn hiện (không chờ rê chuột) — chỉ điền sẵn lệnh, BA tự gửi
            <button
              type="button"
              onClick={() => onDraft(sectionLabel(section))}
              className="text-caption font-bold px-2 py-0.5 rounded-full text-primary hover:bg-primary-soft cursor-pointer"
            >
              {t("draftSection")}
            </button>
          )}
          {onEdit && (
            // Hiện khi rê chuột / focus vào mục: sửa ngay chỗ đang đọc, lệnh gõ tiếp ở ô chat
            <button
              type="button"
              onClick={() => onEdit(sectionLabel(section))}
              className="opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 text-caption font-bold px-2 py-0.5 rounded-full text-primary hover:bg-primary-soft cursor-pointer transition-opacity"
            >
              {t("editSection")}
            </button>
          )}
        </div>
      </div>
      {section.blocks.length > 0 && (
        <>
          {section.blocks.map((block, i) => (
            <BlockSlot
              key={i}
              regionKey={blockRegionKey(section.id, i)}
              state={regionState(blockRegionKey(section.id, i))}
              spaced={block.type === "paragraph" && i < section.blocks.length - 1}
            >
              <BlockView
                block={block}
                projectId={projectId}
                afterHeading={followsHeading(section.blocks, i)}
                onRedrawDiagram={onRedrawDiagram}
              />
            </BlockSlot>
          ))}
          {onRedraw && section.blocks.some((b) => b.type === "image") && <RedrawSectionButton onRedraw={onRedraw} />}
        </>
      )}
    </article>
  );
}

/** Chuỗi trong `useDocument` của pane tự tải (không có `doc` từ ngoài). */
function SelfLoadingDocumentPane({ refreshToken = 0, documentLanguage = null, ...props }: Omit<DocumentPaneProps, "doc">) {
  const doc = useDocument(props.projectId, "draft", undefined, refreshToken, documentLanguage);
  return <DocumentPaneView {...props} documentLanguage={documentLanguage} doc={doc} />;
}

/** Document pane thật (T16): render `GET /document` (RenderedDocument, T15) — chỉ đọc. */
export default function DocumentPane({ doc, ...props }: DocumentPaneProps) {
  return doc ? <DocumentPaneView {...props} doc={doc} /> : <SelfLoadingDocumentPane {...props} />;
}

function DocumentPaneView({
  projectId,
  projectName,
  flags = [],
  doc,
  onSelectStep,
  emptyHintOf,
  mode1 = false,
  onEditSection,
  onDraftSection,
  requiredTemplate = false,
  libraryMatchOf,
  onUseLibrary,
  onSaveToLibrary,
  libraryEmptyCount = 0,
  onUseLibraryAll,
  onCommentSection,
  commentCountOf,
  onOpenSectionComments,
  issues,
  onOpenIssues,
  onOpenSectionIssues,
  rewriteError = null,
  onSectionsLoaded,
  headerEnd,
  onRedrawSection,
  onRedrawDiagram,
  hasDiagrams,
  documentLanguage = null,
  onTranslate,
  newerVersion = null,
}: Omit<DocumentPaneProps, "doc" | "refreshToken"> & { doc: UseDocumentResult }) {
  const t = useTranslations("workspace.document");
  const tHook = useTranslations("workspace.hookErrors");
  const name = projectName ?? t("untitled");
  const { document, translation, loading, refreshing, empty, error, refreshError, reload, lastDiff, pendingSectionIds } = doc;
  // Ảnh báo `IMAGE_CHANGED` ⇒ tải lại tài liệu đúng một lượt (nhiều ảnh cùng báo, hoặc vẫn lệch sau khi tải ⇒ không lặp)
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);
  const lastImageReloadAt = useRef(0);
  const onImageChanged = useCallback(() => {
    const now = Date.now();
    if (now - lastImageReloadAt.current < IMAGE_RELOAD_MIN_GAP_MS) return;
    lastImageReloadAt.current = now;
    void reloadRef.current();
  }, []);
  const language = shownDocumentLanguage(translation, documentLanguage);
  // Mode 1 không dịch (D3) — dù có truyền nhầm thì cũng không hiện nút
  const translate = mode1 ? undefined : onTranslate;

  useEffect(() => {
    if (document) onSectionsLoaded?.(document.sections);
  }, [document, onSectionsLoaded]);

  // ─── Mục đang / vừa cập nhật ────────────────────────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const progress = useUpdateRegions(scrollRef, lastDiff);
  const regionSet = useMemo(() => new Set(lastDiff?.regions ?? []), [lastDiff]);
  const regionState = (key: string): UpdateState => (regionSet.has(key) ? (progress.settled.has(key) ? "settled" : "fresh") : null);
  const unseenRegions = lastDiff && progress.observed ? lastDiff.regions.filter((key) => !progress.seen.has(key)) : [];
  const [dismissedGeneric, setDismissedGeneric] = useState(0);
  const jumpToUnseen = () => {
    const target = unseenRegions[0];
    if (!target) return;
    const el = [...(scrollRef.current?.querySelectorAll<HTMLElement>("[data-update-region]") ?? [])].find((node) => node.dataset.updateRegion === target);
    // `start`: mục cao (bảng dài) căn giữa sẽ đẩy tiêu đề mục khỏi khung nhìn. `?.` trên chính hàm: jsdom không có
    // `scrollIntoView`
    el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };
  /** Lời đọc cho trình đọc màn hình khi bản mới về: "Đã cập nhật mục §2.2.1 Use Case Diagram". */
  const announcement = (() => {
    if (!lastDiff || !document) return "";
    if (lastDiff.broad) return t("updatedGeneric");
    const changed = document.sections.filter((section) => lastDiff.sections.has(section.id));
    return changed.length <= 3 ? t("updatedSections", { sections: changed.map(sectionLabel).join(", ") }) : t("updatedMany", { count: changed.length });
  })();

  const openFlags = flags.filter((f) => !f.resolved_at && (f.level === "red" || !f.waived_by_user)); // FLF-329: cờ đỏ giữ nguyên vẫn mở
  const issuesOf = (sectionId: string) => {
    const own = openFlags.filter((f) => f.section_id === sectionId);
    return { count: own.length, blocking: own.some((f) => f.level === "red") };
  };
  // Mẫu sau đổi mẫu có thể có nhiều heading cùng `section_id` (vd. ba mục giao diện cùng §4.1) ⇒ key thêm số thứ tự lần lặp
  const sectionKeys = sectionRenderKeys(document?.sections ?? []);

  return (
    <ImageChangedContext.Provider value={onImageChanged}>
    <section className="relative flex-1 bg-surface-container-lowest flex flex-col min-w-[320px] overflow-hidden">
      {/* Trình đọc màn hình: báo mục vừa cập nhật khi bản mới về (vùng live luôn có mặt để lời đọc được phát) */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div className="ff-fade-below [--ff-fade:var(--color-surface-container-lowest)] px-6 flex items-center justify-between gap-3 shrink-0 h-12 bg-surface-container-lowest">
        {/* Tên dài thì cắt "…", nhãn không bao giờ xuống dòng. Pane hẹp ⇒ cắt cả nhãn phiên bản, không tràn đè lên nhóm nút
            bên phải (FLF-265: chip ngôn ngữ làm nhóm phải rộng thêm) */}
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <h3 className="font-bold text-body text-on-surface truncate" title={t("heading", { name })}>
            {t("heading", { name })}
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
              title={t("openIssuesTitle")}
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
                ? t("blockingCount", { count: issues.blocking })
                : issues.suggestions > 0
                  ? t("suggestionCount", { count: issues.suggestions })
                  : t("noIssues")}
            </button>
          )}
          {language && <DocumentLanguageChip language={language} compact />}
          {/*
            Tài liệu tự cập nhật sau mỗi bước và mỗi lệnh sửa (BE dựng bản còn thiếu lúc đọc) — nút này chỉ còn để
            kéo về thay đổi đến từ phiên khác, không còn trạng thái "đã cũ" nào để người dùng phải tự xử lý.
            Chỉ icon, kích thước cố định 32×32 (đổi trạng thái không xô lệch header): xoay + khoá trong MỌI lượt làm mới
            (bấm tay hay tự tải); lỗi thì icon đứng yên lại và bấm thử lại được.
          */}
          <button
            type="button"
            onClick={() => void reload()}
            disabled={refreshing}
            aria-busy={refreshing}
            aria-label={refreshing ? t("refreshing") : t("refresh")}
            title={refreshing ? t("refreshing") : t("refresh")}
            className="shrink-0 w-8 h-8 grid place-items-center rounded-control text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface cursor-pointer transition-colors disabled:cursor-default motion-reduce:disabled:opacity-60"
          >
            <Icon name="refresh" size={15} className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined} />
          </button>
          {headerEnd}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto ff-scroll px-8 py-6 space-y-1.5 bg-surface-container-lowest">
        {newerVersion && (
          <div role="status" className="sticky top-0 z-10 rounded-control bg-primary-soft px-3 py-1.5 flex items-center gap-1.5 text-body text-on-surface">
            <Icon name="refresh" size={14} className="text-primary" />
            <span>{t("newerVersion")}</span>
            <span aria-hidden>·</span>
            <button type="button" onClick={newerVersion.onApply} className="font-bold text-primary hover:underline cursor-pointer">
              {t("newerVersionApply")}
            </button>
          </div>
        )}
        {/* Lỗi nằm trong vùng cuộn: đặt ngay dưới header thì bị lớp mờ của header che */}
        {/* Tải lại lỗi khi đang có tài liệu: bản đang đọc giữ nguyên, chỉ báo nhỏ (nút làm mới bấm lại được) */}
        {document && refreshError && (
          <p role="alert" className="text-caption text-error">
            {t("refreshFailed", { error: hookErrorText(refreshError, tHook) })}
          </p>
        )}
        {rewriteError && (
          <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-error">
            {t("rewriteFailed", { error: rewriteError })}
          </p>
        )}
        {/*
          FLF-265: tài liệu khác ngôn ngữ gốc mà còn mục chưa có bản dịch — các mục đó đang in chữ gốc. Nội dung mới đã
          dịch ngay trong lượt AI ghi (D16), nên phần này thường là nội dung có từ trước khi đổi ngôn ngữ dự án.
        */}
        {translation && translation.missing > 0 && (
          <div role="status" className="rounded-control bg-accent-gold-soft border border-accent-gold-border px-3 py-2 text-body text-accent-gold-text flex items-center gap-1.5 flex-wrap">
            <Icon name="translate" size={14} />
            <span title={t("untranslatedTitle")}>{t("untranslated", { count: translation.missing })}</span>
            {translate && (
              <>
                <span aria-hidden>·</span>
                <button type="button" onClick={translate} className="font-bold hover:underline cursor-pointer">
                  {t("translate")}
                </button>
              </>
            )}
          </div>
        )}
        {loading && <div className="text-body text-on-surface-muted italic">{t("loading")}</div>}

        {/* Dự án chưa chạy bước nào: nói tài liệu sẽ tự hiện, không mời bấm gì — không có việc nào cho người dùng ở đây */}
        {empty && <div className="text-body text-on-surface-muted italic">{t("emptyDocument")}</div>}

        {!empty && error && (
          <div className="bg-error-container rounded-card p-3.5 text-body text-on-error-container">
            {t("loadFailedWith", { error: hookErrorText(error, tHook) })}
          </div>
        )}

        {document && onUseLibraryAll && libraryEmptyCount > 0 && (
          <div role="status" className="rounded-card bg-primary-soft px-3.5 py-2.5 flex flex-wrap items-center gap-3 text-body text-on-surface">
            <span className="flex-1 min-w-[200px]">{t("libraryBanner", { count: libraryEmptyCount })}</span>
            <button type="button" onClick={onUseLibraryAll} className="text-caption font-bold px-2.5 py-1 rounded-full bg-primary text-on-primary cursor-pointer">
              {t("libraryApplyAll")}
            </button>
          </div>
        )}
        {document &&
          document.sections.map((section, i) => (
            <SectionView
              key={sectionKeys[i]}
              section={section}
              hasChildren={(document.sections[i + 1]?.level ?? 0) > section.level}
              projectId={projectId}
              issues={issuesOf(section.id)}
              onOpenIssues={onOpenSectionIssues ? () => onOpenSectionIssues(section.id) : undefined}
              pending={pendingSectionIds.has(section.id)}
              regionState={regionState}
              onSelectStep={onSelectStep}
              emptyHint={section.blocks.length === 0 ? emptyHintOf?.(section.id) : undefined}
              mode1={mode1}
              onEdit={onEditSection}
              onDraft={onDraftSection}
              requiredTemplate={requiredTemplate}
              libraryMatch={libraryMatchOf?.(section.id)}
              onUseLibrary={onUseLibrary ? () => onUseLibrary(section.id) : undefined}
              onSaveToLibrary={onSaveToLibrary ? () => onSaveToLibrary(section.id) : undefined}
              onComment={onCommentSection ? (label) => onCommentSection({ sectionId: section.id, label }) : undefined}
              commentCount={commentCountOf?.(section.id) ?? 0}
              onOpenComments={onOpenSectionComments ? () => onOpenSectionComments(section.id) : undefined}
              onRedraw={onRedrawSection && hasDiagrams?.(section.id) ? () => onRedrawSection(section.id) : undefined}
              onRedrawDiagram={onRedrawDiagram}
            />
          ))}
      </div>

      <DocumentUpdatePill
        pendingCount={pendingSectionIds.size}
        updatedCount={unseenRegions.length}
        generic={Boolean(lastDiff?.broad) && dismissedGeneric !== lastDiff?.seq}
        onJump={jumpToUnseen}
        onDismiss={() => setDismissedGeneric(lastDiff?.seq ?? 0)}
      />
    </section>
    </ImageChangedContext.Provider>
  );
}
