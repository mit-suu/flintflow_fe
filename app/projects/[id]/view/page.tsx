"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import BackLink from "@/components/ui/BackLink";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { STICKY_FADE } from "@/components/ui/sticky-styles";
import { downloadWordExport, getDocument, listBaselines } from "@/lib/api/export";
import { saveBlob } from "@/lib/api/files";
import { getProgress } from "@/lib/api/pipeline";
import { getProject } from "@/lib/api/projects";
import { fetchOrganization } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import { createComment, listComments, replyComment, resolveComment } from "@/lib/api/comments";
import { userErrorMessage } from "@/lib/api/error-messages";
import { knownDocumentLanguage, shownDocumentLanguage, translationMetaOf } from "@/lib/document-language";
import { sectionLabel } from "../_components/DocumentPane";
import CommentPanel, { commentTab, type CommentTab, type CommentTarget } from "../_components/CommentPanel";
import DocumentLanguageChip from "../_components/DocumentLanguageChip";
import ViewDocument, { pinDomId, pinKey, ViewDocumentError, ViewDocumentSkeleton } from "./view-document";
import CommentSheet, { COMMENT_COLUMN_ID, useIsDesktop } from "./comment-sheet";
import ResizeHandle from "../_components/ResizeHandle";
import { useResizableWidth } from "../hooks/useResizableWidth";
import type { DocumentTranslationMeta, RenderedDocument, RenderedSection } from "@/types/document";
import type { ProgressResponse } from "@/types/pipeline";
import type { Baseline } from "@/types/spine";
import type { CommentResolutionInput, SrsComment } from "@/types/comment";
import type { OrgRole } from "@/types/organization";
import type { DocumentLanguage, ProjectMode } from "@/types/project";

/** Chu kỳ tải lại comment khi tab đang hiện — đủ nhanh để thấy trả lời / xử lý của người khác, không cần F5. */
const COMMENT_POLL_MS = 15_000;

/** Thời gian nền của chỗ ghim còn đậm sau khi bấm "chỗ ghim" trên thẻ comment — đủ để mắt bắt được đang ở đâu. */
const LOCATE_FLASH_MS = 1600;

/** Bản đang đọc: `draft` hoặc `id` của một baseline (`BLnnn`). */
type VersionKey = "draft" | string;

/** Lỗi API ⇒ `Error` mang câu cho người dùng (panel comment hiện `message`). */
const asUserError = (err: unknown, fallback: string): Error => new Error(userErrorMessage(err, fallback));

/**
 * Lỗi đọc trong effect/callback không có câu của BE ⇒ lưu mã, dịch lúc render (đưa `t` vào dependency sẽ tải lại tài liệu
 * và comment mỗi lần đổi ngôn ngữ).
 */
const DOC_LOAD_FAILED = "@loadFailed";
const COMMENTS_LOAD_FAILED = "@commentsLoadFailed";

/** Bề rộng cột comment user đã kéo (desktop) — nhớ qua các lần mở trang, như các khung của workspace. */
const COMMENTS_WIDTH_KEY = "flintflow_view_comments_width";
const COMMENTS_MIN = 300;
/** Tài liệu không bị kéo hẹp hơn mức này (vẫn đọc được bảng và tiêu đề). */
const DOC_MIN = 420;
const MAIN_ID = "view-main";

/**
 * Read-only projection (UC 1.14): section bắt buộc chưa `accepted` chỉ hiện tiêu đề +
 * "chưa hoàn thiện". Không hiện flags, assumptions, `by`/`reason` của change, readiness, hay
 * chip stale — chỉ nội dung đã chốt.
 *
 * Trang này đọc qua Bearer token của thành viên project đã đăng nhập (`authFetch`), không phải
 * link chia sẻ công khai — "chỉ đọc" ở đây nghĩa là ẩn các trường nội bộ (flags/readiness/stale)
 * cho member xem nhanh. Chia sẻ ra NGOÀI nhóm làm việc (không cần đăng nhập FlintFlow) cần
 * share-token riêng — chưa có endpoint, XREQ với BE khi cần (ngoài phạm vi T16).
 *
 * UC-49: chọn phiên bản (bản nháp / baseline) và ghim comment vào một section hoặc một block. Viewer chỉ comment trên
 * bản đã phát hành (BR-27) — mặc định mở baseline mới nhất cho Viewer. `?comment=CM-001` (link từ thông báo) làm nổi
 * comment đó.
 *
 * Bố cục: tài liệu chảy liền trên nền trắng (thước đọc 760px), panel comment là cột phải dính (desktop) hoặc bottom sheet
 * (dưới 1024px) — xem `comment-sheet.tsx`.
 */
export default function ReadOnlyDocumentPage() {
  const t = useTranslations("workspace.view");
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params?.id as string;
  const highlightId = searchParams?.get("comment") ?? null;
  const isDesktop = useIsDesktop();
  // Desktop: tài liệu và cột comment chia nhau chiều ngang, kéo thanh giữa để đổi cỡ (nháy đúp về mặc định)
  const commentsWidth = useResizableWidth({
    storageKey: COMMENTS_WIDTH_KEY,
    defaultWidth: 400,
    min: COMMENTS_MIN,
    max: () => {
      const main = document.getElementById(MAIN_ID);
      return main ? main.clientWidth - DOC_MIN - 64 : COMMENTS_MIN;
    },
    measure: (x) => {
      const el = document.getElementById(COMMENT_COLUMN_ID);
      return el ? el.getBoundingClientRect().right - x : null;
    },
  });

  const [doc, setDoc] = useState<RenderedDocument | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  /** FLF-265: ngôn ngữ suy từ dự án + `meta.translation` của bản đang đọc — ghép thành chip chỉ đọc ở header. */
  const [projectLanguage, setProjectLanguage] = useState<DocumentLanguage | null>(null);
  const [translation, setTranslation] = useState<DocumentTranslationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Tăng để tải lại đúng phiên bản đang chọn (nút "Thử lại"). */
  const [reloadToken, setReloadToken] = useState(0);

  const [role, setRole] = useState<OrgRole | null>(null);
  const [mode, setMode] = useState<ProjectMode | null>(null);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  /** `null` cho tới khi biết vai trò + baseline (để Viewer mở thẳng baseline mới nhất). */
  const [version, setVersion] = useState<VersionKey | null>(null);

  const [comments, setComments] = useState<SrsComment[]>([]);
  /** Tab người dùng chọn; `null` = tự chọn (link `?comment=` tới comment đã đóng ⇒ tab "Đã đóng"). */
  const [tabChoice, setTabChoice] = useState<CommentTab | null>(null);
  const [target, setTarget] = useState<CommentTarget | null>(null);
  const [focus, setFocus] = useState<{ section_id: string; block_index: number | null } | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  /** Sheet comment trên màn hẹp; link `?comment=` mở sẵn để thấy ngay comment được trỏ tới. Desktop bỏ qua state này. */
  const [sheetOpen, setSheetOpen] = useState(() => highlightId !== null);
  /** Chỗ ghim vừa được trỏ tới từ thẻ comment — nền đậm trong chốc lát. */
  const [located, setLocated] = useState<string | null>(null);

  // Vai trò, mode và danh sách baseline — quyết định bản mở mặc định. Lỗi thì coi như chưa biết (BE vẫn chặn).
  useEffect(() => {
    if (!projectId) return;
    const orgId = getActiveOrgId();
    Promise.allSettled([
      orgId ? fetchOrganization(orgId).then((org) => org.role) : Promise.resolve(null),
      getProject(projectId),
      listBaselines(projectId),
    ]).then(([roleResult, projectResult, baselinesResult]) => {
      const nextRole = roleResult.status === "fulfilled" ? roleResult.value : null;
      const nextBaselines = baselinesResult.status === "fulfilled" ? (baselinesResult.value.data ?? []) : [];
      const project = projectResult.status === "fulfilled" ? projectResult.value.data : null;
      setRole(nextRole);
      setMode(project?.mode ?? null);
      // Ngôn ngữ tài liệu (FLF-265) — lỗi thì thôi hiện chip
      setProjectLanguage(knownDocumentLanguage(project));
      setBaselines(nextBaselines);
      const latest = nextBaselines[nextBaselines.length - 1];
      setVersion(nextRole === "viewer" && latest ? latest.id : "draft");
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || version === null) return;
    const source = version === "draft" ? "draft" : "baseline";
    // `allSettled`: `/progress` lỗi (vd chưa có quyền) không được kéo cả tài liệu xuống trang trắng
    // — tài liệu vẫn hiện, chỉ mất khả năng ẩn section theo `required`/`status` (coi như đã đủ).
    // Đổi phiên bản / "Thử lại" liên tiếp: lượt cũ về muộn không được đè tài liệu của lượt mới
    let stale = false;
    Promise.allSettled([getDocument(projectId, source, version === "draft" ? undefined : version), getProgress(projectId)]).then(
      ([docResult, progressResult]) => {
        if (stale) return;
        if (docResult.status === "fulfilled") {
          setDoc(docResult.value.data);
          setTranslation(translationMetaOf(docResult.value.meta));
          setError(null);
        } else {
          setDoc(null);
          setTranslation(null);
          setError(docResult.reason instanceof Error ? docResult.reason.message : DOC_LOAD_FAILED);
        }
        setProgress(progressResult.status === "fulfilled" ? progressResult.value.data : null);
        setLoading(false);
      }
    );
    return () => {
      stale = true;
    };
  }, [projectId, version, reloadToken]);

  // Mọi lượt tải comment (sau khi ghi, poll, quay lại tab) đánh số; chỉ lượt mới nhất được ghi state — lượt cũ về
  // muộn không được đè dữ liệu mới (vd poll bắt đầu trước khi trả lời, về sau lượt tải lại của chính trả lời đó).
  const commentLoadSeq = useRef(0);

  const refreshComments = useCallback(async () => {
    const seq = ++commentLoadSeq.current;
    try {
      const res = await listComments(projectId, "all");
      if (seq !== commentLoadSeq.current) return;
      setComments(res.data ?? []);
      setCommentError(null);
    } catch (err) {
      if (seq !== commentLoadSeq.current) return;
      setCommentError(userErrorMessage(err, COMMENTS_LOAD_FAILED));
    }
  }, [projectId]);

  // Người khác trả lời / xử lý / chuyển CR thì panel tự cập nhật: poll khi tab đang hiện + tải lại khi quay về tab.
  useEffect(() => {
    if (!projectId) return;
    const load = () => {
      if (document.visibilityState !== "hidden") void refreshComments();
    };
    load();
    const timer = window.setInterval(load, COMMENT_POLL_MS);
    document.addEventListener("visibilitychange", load);
    window.addEventListener("focus", load);
    const seqRef = commentLoadSeq;
    return () => {
      // Bỏ kết quả của lượt đang bay khi rời trang / đổi project
      seqRef.current += 1;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("focus", load);
    };
  }, [projectId, refreshComments]);

  useEffect(() => {
    if (!highlightId || comments.length === 0) return;
    document.getElementById(`comment-${highlightId}`)?.scrollIntoView?.({ block: "center" });
  }, [highlightId, comments]);

  // Nền "vừa trỏ tới" chỉ sống chốc lát
  useEffect(() => {
    if (!located) return;
    const timer = window.setTimeout(() => setLocated(null), LOCATE_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [located]);

  const isIncomplete = (section: RenderedSection): boolean => {
    const info = progress?.sections.find((s) => s.id === section.id);
    return Boolean(info?.required && info.status !== "accepted");
  };

  // `meta.translation` của chính bản đang đọc thắng ngôn ngữ suy từ dự án
  const language = shownDocumentLanguage(translation, projectLanguage);

  const baseline = version && version !== "draft" ? baselines.find((b) => b.id === version) : undefined;
  const versionLabel = baseline ? baseline.version : t("draftLabel");
  const commentBlockedReason =
    role === "viewer" && !baseline
      ? baselines.length
        ? t("viewerPickBaseline")
        : t("viewerNoBaseline")
      : null;
  const canComment = commentBlockedReason === null && !!doc;

  // UC-50: tải bản đã phát hành (Viewer chỉ tải được bản này — bản nháp BE trả 403)
  const [downloading, setDownloading] = useState(false);
  const download = async (baselineId: string) => {
    setDownloading(true);
    try {
      const { blob, filename } = await downloadWordExport(projectId, "baseline", baselineId);
      saveBlob(blob, filename ?? `${doc?.projectName ?? "SRS"}_v${versionLabel}.docx`);
    } catch (err) {
      setError(userErrorMessage(err, t("downloadFailed")));
    } finally {
      setDownloading(false);
    }
  };

  const highlighted = highlightId ? comments.find((c) => c.comment_id === highlightId) : undefined;
  const tab: CommentTab = tabChoice ?? (highlighted ? commentTab(highlighted) : "open");

  /** Số comment của tab đang mở trên từng chỗ ghim — `section_id` hoặc `section_id#block`. */
  const pinCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of comments) {
      if (commentTab(c) !== tab) continue;
      const key = pinKey(c.anchor.section_id, c.anchor.block_index);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [comments, tab]);

  /** Chỗ ghim đang được nói tới: đang soạn, đang lọc, vừa trỏ tới. */
  const activeKeys = useMemo(() => {
    const keys = new Set<string>();
    if (target) keys.add(pinKey(target.section_id, target.block_index));
    if (focus) keys.add(pinKey(focus.section_id, focus.block_index));
    if (located) keys.add(located);
    return keys;
  }, [target, focus, located]);

  // Tài liệu chưa tải xong / tải lỗi ⇒ chưa biết, không gắn cờ "mất chỗ ghim" cho mọi comment
  const anchorExists = (c: SrsComment): boolean => {
    if (!doc) return true;
    const section = doc.sections.find((s) => s.id === c.anchor.section_id);
    if (!section) return false;
    return c.anchor.block_index === null || c.anchor.block_index < section.blocks.length;
  };

  const startComment = (section: RenderedSection, blockIndex: number | null) => {
    const heading = sectionLabel(section);
    setTarget({ section_id: section.id, block_index: blockIndex, label: blockIndex === null ? heading : `${heading} › Block ${blockIndex + 1}` });
    if (!isDesktop) setSheetOpen(true);
  };

  const showComments = (sectionId: string, blockIndex: number | null) => {
    setFocus({ section_id: sectionId, block_index: blockIndex });
    if (!isDesktop) setSheetOpen(true);
  };

  /** Từ thẻ comment về chỗ ghim trong tài liệu: cuộn tới + nền đậm chốc lát; trên màn hẹp đóng sheet để thấy tài liệu. */
  const locate = (c: SrsComment) => {
    // Block của mục đang "chưa hoàn thiện" không được vẽ ⇒ lùi về tiêu đề mục
    const keys = [pinKey(c.anchor.section_id, c.anchor.block_index), pinKey(c.anchor.section_id, null)];
    const key = keys.find((k) => document.getElementById(pinDomId(k)));
    if (!key) return;
    setSheetOpen(false);
    setLocated(key);
    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(pinDomId(key))?.scrollIntoView?.({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  };

  const post = async (text: string) => {
    if (!target) return;
    try {
      await createComment(projectId, {
        version: baseline ? { source: "baseline", baseline_id: baseline.id } : { source: "draft" },
        anchor: { section_id: target.section_id, block_index: target.block_index },
        text,
      });
    } catch (err) {
      throw asUserError(err, t("postFailed"));
    }
    setTarget(null);
    // Comment mới luôn "Đang mở" — đang ở tab "Đã đóng" thì chuyển về để thấy nó
    setTabChoice("open");
    await refreshComments();
  };

  const reply = async (commentId: string, text: string) => {
    try {
      await replyComment(projectId, commentId, text);
    } catch (err) {
      throw asUserError(err, t("replyFailed"));
    }
    await refreshComments();
  };

  // Hai nhánh như workspace: "đã sửa" (BE mở lại bước sở hữu mục nếu đã duyệt) hoặc "giữ nguyên" kèm lý do
  const resolve = async (commentId: string, resolution: CommentResolutionInput) => {
    try {
      await resolveComment(projectId, commentId, resolution);
    } catch (err) {
      throw asUserError(err, t("resolveFailed"));
    }
    await refreshComments();
  };

  const errorText = error === DOC_LOAD_FAILED ? t("loadFailed") : error;
  const openCount = comments.filter((c) => commentTab(c) === "open").length;
  const sheetModal = !isDesktop && sheetOpen;

  return (
    <div className="min-h-dvh bg-surface-container-lowest">
      <header inert={sheetModal} className={`sticky top-0 z-30 bg-surface-container-lowest ${STICKY_FADE}`}>
        <div className="max-w-[1280px] lg:max-w-none mx-auto px-4 sm:px-6 lg:px-8 py-3 lg:h-16 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-3 min-w-0 flex-1 basis-[280px]">
            {/* Viewer không có workspace (bị chuyển về đây) ⇒ quay về danh sách dự án */}
            <BackLink href={role === "viewer" ? "/home" : `/projects/${projectId}`} className="shrink-0">
              <span className="max-sm:sr-only">{role === "viewer" ? t("backToProjects") : t("backToWorkspace")}</span>
            </BackLink>
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <h1 className="text-heading font-bold text-on-surface truncate min-w-0 max-w-full">{doc?.projectName ?? t("untitled")}</h1>
              <Badge tone="neutral">
                <Icon name="eye" size={12} />
                {t("readOnly")}
              </Badge>
              {language && <DocumentLanguageChip language={language} />}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <LocaleSwitcher className="shrink-0" />
            {version !== null && (
              <label className="flex items-center gap-2 text-body text-on-surface-variant">
                <span className="max-sm:sr-only">{t("version")}</span>
                <span className="relative inline-flex">
                  <select
                    value={version}
                    onChange={(e) => {
                      setLoading(true);
                      setTarget(null);
                      setVersion(e.target.value);
                    }}
                    className="appearance-none h-10 sm:h-9 pl-3 pr-8 rounded-control bg-surface-container-high text-body font-semibold text-on-surface cursor-pointer hover:bg-surface-container-highest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="draft">{t("draft")}</option>
                    {baselines.map((b) => (
                      <option key={b.id} value={b.id}>
                        {t("baselineOption", { version: b.version })}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron-down" size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                </span>
              </label>
            )}
            {baseline && (
              <Button variant="secondary" size="sm" icon="export" loading={downloading} onClick={() => void download(baseline.id)} className="max-sm:h-10">
                {downloading ? t("downloading") : t("download", { version: baseline.version })}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main
        id={MAIN_ID}
        className="max-w-[1280px] lg:max-w-none mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28 lg:pb-12 lg:flex lg:items-start lg:gap-3"
      >
        <div inert={sheetModal} className="min-w-0 w-full max-w-[760px] mx-auto lg:max-w-none lg:flex-1 lg:pl-6 xl:pl-10 lg:pr-3">
          <ViewAbout viewer={role === "viewer"} />
          {loading ? (
            <ViewDocumentSkeleton />
          ) : !doc ? (
            error && (
              <ViewDocumentError
                message={t("loadFailedWith", { error: errorText ?? "" })}
                onRetry={() => {
                  setLoading(true);
                  setReloadToken((n) => n + 1);
                }}
              />
            )
          ) : (
            <div className="flex flex-col gap-4">
              {/* Tài liệu vẫn hiện; lỗi phụ (vd tải file thất bại) báo ở trên, không thay cả trang */}
              {error && (
                <p role="alert" className="flex items-start gap-2 bg-error-container text-on-error-container rounded-control px-3 py-2.5 text-body">
                  <Icon name="error-circle" size={16} className="shrink-0 mt-0.5 text-error" />
                  <span>{errorText}</span>
                </p>
              )}
              {doc.sections.length === 0 ? (
                <EmptyState icon="file" title={t("empty")} />
              ) : (
                <ViewDocument
                  doc={doc}
                  projectId={projectId}
                  isIncomplete={isIncomplete}
                  pinCounts={pinCounts}
                  canComment={canComment}
                  activeKeys={activeKeys}
                  onStartComment={startComment}
                  onShowComments={showComments}
                />
              )}
            </div>
          )}
        </div>

        <div className="hidden lg:flex sticky top-20 h-[calc(100dvh-6rem)] items-center">
          <ResizeHandle active={commentsWidth.resizing} onStart={commentsWidth.startResize} onReset={commentsWidth.reset} label={t("resizeComments")} visible />
        </div>

        <CommentSheet isDesktop={isDesktop} open={sheetOpen} onOpenChange={setSheetOpen} openCount={openCount}
          desktopWidth={commentsWidth.width}
          desktopMaxWidth={`calc(100% - ${DOC_MIN + 64}px)`}
        >
          <CommentPanel
            projectId={projectId}
            comments={comments}
            role={role}
            canCreateCr={mode === "import" && baselines.length > 0}
            commentBlockedReason={commentBlockedReason}
            versionLabel={versionLabel}
            anchorExists={anchorExists}
            target={target}
            focus={focus}
            highlightId={highlightId}
            tab={tab}
            onTabChange={(next) => {
              setTabChoice(next);
              setFocus(null);
            }}
            onClearFocus={() => setFocus(null)}
            onCancelTarget={() => setTarget(null)}
            onPost={post}
            onReply={reply}
            onResolve={resolve}
            onLocate={locate}
            onClose={isDesktop ? undefined : () => setSheetOpen(false)}
            loadError={commentError ? (commentError === COMMENTS_LOAD_FAILED ? t("commentsLoadFailed") : commentError) : null}
          />
        </CommentSheet>
      </main>
    </div>
  );
}

/**
 * Một khối giải thích trang này khác workspace ở đâu: ở đây đọc + góp ý theo phiên bản, không sửa nội dung. Viewer không
 * có workspace nên câu cho họ nói về việc nhóm soạn xử lý comment; Lead/Analyst được nhắc chỗ sửa thật là chat.
 */
function ViewAbout({ viewer }: { viewer: boolean }) {
  const t = useTranslations("workspace.view.about");
  return (
    <section aria-label={t("title")} className="mb-6 flex items-start gap-3 bg-surface-container-low rounded-card px-4 py-3">
      <Icon name="info" size={16} className="shrink-0 mt-0.5 text-primary" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <h2 className="text-body font-bold text-on-surface">{t("title")}</h2>
        <p className="text-caption text-on-surface-variant leading-relaxed">{viewer ? t("viewer") : t("member")}</p>
      </div>
    </section>
  );
}
