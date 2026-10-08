"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import BackLink from "@/components/ui/BackLink";
import { getDocument, listBaselines } from "@/lib/api/export";
import { getProgress } from "@/lib/api/pipeline";
import { getProject } from "@/lib/api/projects";
import { fetchOrganization } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import { createComment, listComments, replyComment, resolveComment } from "@/lib/api/comments";
import { userErrorMessage } from "@/lib/api/error-messages";
import { BlockView, followsHeading, sectionLabel } from "../_components/DocumentPane";
import CommentPanel, { commentTab, type CommentTab, type CommentTarget } from "../_components/CommentPanel";
import type { RenderedDocument, RenderedSection } from "@/types/document";
import type { ProgressResponse } from "@/types/pipeline";
import type { Baseline } from "@/types/spine";
import type { SrsComment } from "@/types/comment";
import type { OrgRole } from "@/types/organization";
import type { ProjectMode } from "@/types/project";

/** Chu kỳ tải lại comment khi tab đang hiện — đủ nhanh để thấy trả lời / xử lý của người khác, không cần F5. */
const COMMENT_POLL_MS = 15_000;

/** Bản đang đọc: `draft` hoặc `id` của một baseline (`BLnnn`). */
type VersionKey = "draft" | string;

/** Lỗi API ⇒ `Error` mang câu tiếng Việt cho người dùng (panel comment hiện `message`). */
const asUserError = (err: unknown, fallback: string): Error => new Error(userErrorMessage(err, fallback));

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
 */
export default function ReadOnlyDocumentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params?.id as string;
  const highlightId = searchParams?.get("comment") ?? null;

  const [doc, setDoc] = useState<RenderedDocument | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setRole(nextRole);
      setMode(projectResult.status === "fulfilled" ? (projectResult.value.data?.mode ?? null) : null);
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
    Promise.allSettled([getDocument(projectId, source, version === "draft" ? undefined : version), getProgress(projectId)]).then(
      ([docResult, progressResult]) => {
        if (docResult.status === "fulfilled") {
          setDoc(docResult.value.data);
          setError(null);
        } else {
          setDoc(null);
          setError(docResult.reason instanceof Error ? docResult.reason.message : "Không tải được tài liệu");
        }
        setProgress(progressResult.status === "fulfilled" ? progressResult.value.data : null);
        setLoading(false);
      }
    );
  }, [projectId, version]);

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
      setCommentError(userErrorMessage(err, "Không tải được comment"));
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

  const isIncomplete = (section: RenderedSection): boolean => {
    const info = progress?.sections.find((s) => s.id === section.id);
    return Boolean(info?.required && info.status !== "accepted");
  };

  const baseline = version && version !== "draft" ? baselines.find((b) => b.id === version) : undefined;
  const versionLabel = baseline ? baseline.version : "nháp";
  const commentBlockedReason =
    role === "viewer" && !baseline
      ? baselines.length
        ? "Viewer chỉ comment được trên phiên bản đã phát hành — chọn một bản baseline ở trên."
        : "Viewer chỉ comment được trên phiên bản đã phát hành — dự án chưa có bản nào."
      : null;
  const canComment = commentBlockedReason === null && !!doc;

  const highlighted = highlightId ? comments.find((c) => c.comment_id === highlightId) : undefined;
  const tab: CommentTab = tabChoice ?? (highlighted ? commentTab(highlighted) : "open");

  /** Số comment của tab đang mở trên từng chỗ ghim — `section_id` hoặc `section_id#block`. */
  const pinCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of comments) {
      if (commentTab(c) !== tab) continue;
      const key = c.anchor.block_index === null ? c.anchor.section_id : `${c.anchor.section_id}#${c.anchor.block_index}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [comments, tab]);

  const anchorExists = (c: SrsComment): boolean => {
    const section = doc?.sections.find((s) => s.id === c.anchor.section_id);
    if (!section) return false;
    return c.anchor.block_index === null || c.anchor.block_index < section.blocks.length;
  };

  const startComment = (section: RenderedSection, blockIndex: number | null) => {
    const heading = sectionLabel(section);
    setTarget({ section_id: section.id, block_index: blockIndex, label: blockIndex === null ? heading : `${heading} › Block ${blockIndex + 1}` });
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
      throw asUserError(err, "Không đăng được comment. Vui lòng thử lại.");
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
      throw asUserError(err, "Không gửi được trả lời. Vui lòng thử lại.");
    }
    await refreshComments();
  };

  const resolve = async (commentId: string) => {
    try {
      await resolveComment(projectId, commentId);
    } catch (err) {
      throw asUserError(err, "Không đánh dấu được. Vui lòng thử lại.");
    }
    await refreshComments();
  };

  /** Số comment của chỗ ghim (bấm để lọc panel) + nút 💬 hiện khi rê chuột. Hàm thường, không phải component con. */
  const pinControls = (section: RenderedSection, blockIndex: number | null) => {
    const key = blockIndex === null ? section.id : `${section.id}#${blockIndex}`;
    const count = pinCounts.get(key) ?? 0;
    return (
      <span className="flex items-center gap-1 shrink-0">
        {count > 0 && (
          <button
            type="button"
            onClick={() => setFocus({ section_id: section.id, block_index: blockIndex })}
            aria-label={`Xem ${count} comment`}
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#EEEDFB] text-[#4A42A8] cursor-pointer"
          >
            💬 {count}
          </button>
        )}
        {canComment && (
          <button
            type="button"
            onClick={() => startComment(section, blockIndex)}
            aria-label={blockIndex === null ? `Comment mục ${sectionLabel(section)}` : `Comment đoạn ${blockIndex + 1} của ${sectionLabel(section)}`}
            title="Ghim comment"
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[12px] px-1 rounded hover:bg-[#F0EEEA] cursor-pointer"
          >
            💬
          </button>
        )}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F3F0] flex flex-col">
      <header className="bg-white border-b border-[#ECEAE5] px-6 py-3 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-extrabold text-[#191817]">{doc?.projectName ?? "Dự án"}</span>
          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#F0EEEA] text-[#6B6862]">Chỉ đọc</span>
        </div>
        <div className="flex items-center gap-3">
          {version !== null && (
            <label className="flex items-center gap-1.5 text-[11.5px] text-[#6B6862]">
              Phiên bản
              <select
                value={version}
                onChange={(e) => {
                  setLoading(true);
                  setTarget(null);
                  setVersion(e.target.value);
                }}
                className="px-2 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-[12px] text-[#191817]"
              >
                <option value="draft">Bản nháp</option>
                {baselines.map((b) => (
                  <option key={b.id} value={b.id}>
                    Bản {b.version}
                  </option>
                ))}
              </select>
            </label>
          )}
          <BackLink href={`/projects/${projectId}`}>Về không gian làm việc</BackLink>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-5 items-start">
          <div className="flex-1 min-w-0 max-w-3xl w-full mx-auto flex flex-col gap-3">
            {loading && <div className="text-[12px] text-[#A8A49C] italic">Đang tải tài liệu…</div>}
            {!loading && error && (
              <div className="bg-[#FDEDED] border border-[#F2CACA] rounded-[14px] p-3.5 text-[11.5px] text-[#8A4141]">
                Không tải được tài liệu: {error}
              </div>
            )}
            {!loading &&
              doc?.sections.map((section) => (
                <article key={section.id} className="p-4 rounded-[12px] border border-[#ECEAE5] bg-white flex flex-col gap-2">
                  <div className="group flex items-start justify-between gap-2">
                    <h5 className="font-bold text-[12.5px] text-[#191817]">
                      {section.number ? `${section.number}. ` : ""}{section.heading}
                    </h5>
                    {pinControls(section, null)}
                  </div>
                  {isIncomplete(section) ? (
                    <div className="text-[11.5px] text-[#A8A49C] italic">chưa hoàn thiện</div>
                  ) : section.blocks.length > 0 ? (
                    section.blocks.map((block, i) => {
                      const pinned = (pinCounts.get(`${section.id}#${i}`) ?? 0) > 0;
                      return (
                        <div key={i} className={`group relative flex items-start gap-2 ${pinned ? "border-l-2 border-[#B9B3EC] pl-2" : ""}`}>
                          <div className="flex-1 min-w-0">
                            <BlockView block={block} projectId={projectId} afterHeading={followsHeading(section.blocks, i)} />
                          </div>
                          {pinControls(section, i)}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[11.5px] text-[#A8A49C] italic">chưa hoàn thiện</div>
                  )}
                </article>
              ))}
          </div>

          <div className="w-full lg:w-[340px] lg:sticky lg:top-0 shrink-0 flex flex-col gap-2">
            {commentError && (
              <p role="alert" className="text-[11.5px] text-[#B03030]">
                {commentError}
              </p>
            )}
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
            />
          </div>
        </div>
      </main>
    </div>
  );
}
