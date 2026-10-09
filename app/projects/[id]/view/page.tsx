"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BackLink from "@/components/ui/BackLink";
import { getDocument } from "@/lib/api/export";
import { getProgress } from "@/lib/api/pipeline";
import { getProject } from "@/lib/api/projects";
import { knownDocumentLanguage, shownDocumentLanguage, translationMetaOf } from "@/lib/document-language";
import { BlockView, followsHeading } from "../_components/DocumentPane";
import DocumentLanguageChip from "../_components/DocumentLanguageChip";
import type { RenderedDocument, RenderedSection } from "@/types/document";
import type { ProgressResponse } from "@/types/pipeline";
import type { DocumentLanguage } from "@/types/project";

/**
 * Read-only projection (UC 1.14): section bắt buộc chưa `accepted` chỉ hiện tiêu đề +
 * "chưa hoàn thiện". Không hiện flags, assumptions, `by`/`reason` của change, readiness, hay
 * chip stale — chỉ nội dung đã chốt.
 *
 * Trang này đọc qua Bearer token của thành viên project đã đăng nhập (`authFetch`), không phải
 * link chia sẻ công khai — "chỉ đọc" ở đây nghĩa là ẩn các trường nội bộ (flags/readiness/stale)
 * cho member xem nhanh. Chia sẻ ra NGOÀI nhóm làm việc (không cần đăng nhập FlintFlow) cần
 * share-token riêng — chưa có endpoint, XREQ với BE khi cần (ngoài phạm vi T16).
 */
export default function ReadOnlyDocumentPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [doc, setDoc] = useState<RenderedDocument | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  /** FLF-265: ngôn ngữ tài liệu cho chip chỉ đọc; `null` (mode 1 chưa biết ngôn ngữ file, hoặc đọc lỗi) ⇒ không hiện chip. */
  const [language, setLanguage] = useState<DocumentLanguage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    // `allSettled`: `/progress` lỗi (vd chưa có quyền) không được kéo cả tài liệu xuống trang trắng
    // — tài liệu vẫn hiện, chỉ mất khả năng ẩn section theo `required`/`status` (coi như đã đủ).
    // `GET /projects/:id` chỉ để biết ngôn ngữ tài liệu (FLF-265) — lỗi thì thôi hiện chip.
    const requests = [getDocument(projectId, "draft"), getProgress(projectId), getProject(projectId)] as const;
    Promise.allSettled(requests).then(([docResult, progressResult, projectResult]) => {
      if (docResult.status === "fulfilled") {
        setDoc(docResult.value.data);
        setError(null);
      } else {
        setError(docResult.reason instanceof Error ? docResult.reason.message : "Không tải được tài liệu");
      }
      setProgress(progressResult.status === "fulfilled" ? progressResult.value.data : null);
      // `meta.translation` của chính tài liệu này thắng ngôn ngữ suy từ dự án
      setLanguage(
        shownDocumentLanguage(
          docResult.status === "fulfilled" ? translationMetaOf(docResult.value.meta) : null,
          projectResult.status === "fulfilled" ? knownDocumentLanguage(projectResult.value.data) : null
        )
      );
      setLoading(false);
    });
  }, [projectId]);

  const isIncomplete = (section: RenderedSection): boolean => {
    const info = progress?.sections.find((s) => s.id === section.id);
    return Boolean(info?.required && info.status !== "accepted");
  };

  return (
    <div className="min-h-screen bg-[#F5F3F0] flex flex-col">
      <header className="bg-white border-b border-[#ECEAE5] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-body font-extrabold text-[#191817]">{doc?.projectName ?? "Dự án"}</span>
          <span className="text-caption font-bold px-2 py-0.5 rounded-full bg-[#F0EEEA] text-[#6B6862]">Chỉ đọc</span>
          {language && <DocumentLanguageChip language={language} />}
        </div>
        <BackLink href={`/projects/${projectId}`}>Về không gian làm việc</BackLink>
      </header>

      <main className="flex-1 ff-scroll overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          {loading && <div className="text-body text-[#A8A49C] italic">Đang tải tài liệu…</div>}
          {!loading && error && (
            <div className="bg-[#FDEDED] border border-[#F2CACA] rounded-[14px] p-3.5 text-body text-[#8A4141]">
              Không tải được tài liệu: {error}
            </div>
          )}
          {!loading &&
            doc?.sections.map((section) => (
              <article key={section.id} className="p-4 rounded-[12px] border border-[#ECEAE5] bg-white flex flex-col gap-2">
                <h5 className="font-bold text-body text-[#191817]">
                  {section.number ? `${section.number}. ` : ""}{section.heading}
                </h5>
                {isIncomplete(section) ? (
                  <div className="text-body text-[#A8A49C] italic">chưa hoàn thiện</div>
                ) : section.blocks.length > 0 ? (
                  section.blocks.map((block, i) => (
                    <BlockView key={i} block={block} projectId={projectId} afterHeading={followsHeading(section.blocks, i)} />
                  ))
                ) : (
                  <div className="text-body text-[#A8A49C] italic">chưa hoàn thiện</div>
                )}
              </article>
            ))}
        </div>
      </main>
    </div>
  );
}
