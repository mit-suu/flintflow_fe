"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getDocument } from "@/lib/api/export";
import { getProgress } from "@/lib/api/pipeline";
import { BlockView } from "../_components/DocumentPane";
import type { RenderedDocument, RenderedSection } from "@/types/document";
import type { ProgressResponse } from "@/types/pipeline";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    // `allSettled`: `/progress` lỗi (vd chưa có quyền) không được kéo cả tài liệu xuống trang trắng
    // — tài liệu vẫn hiện, chỉ mất khả năng ẩn section theo `required`/`status` (coi như đã đủ).
    Promise.allSettled([getDocument(projectId, "draft"), getProgress(projectId)]).then(([docResult, progressResult]) => {
      if (docResult.status === "fulfilled") {
        setDoc(docResult.value.data);
        setError(null);
      } else {
        setError(docResult.reason instanceof Error ? docResult.reason.message : "Không tải được tài liệu");
      }
      setProgress(progressResult.status === "fulfilled" ? progressResult.value.data : null);
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
          <span className="text-[13px] font-extrabold text-[#191817]">{doc?.projectName ?? "Dự án"}</span>
          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#F0EEEA] text-[#6B6862]">Chỉ đọc</span>
        </div>
        <Link href={`/projects/${projectId}`} className="text-[11.5px] font-bold text-[#4F46E5] hover:underline">
          ← Về không gian làm việc
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          {loading && <div className="text-[12px] text-[#A8A49C] italic">Đang tải tài liệu…</div>}
          {!loading && error && (
            <div className="bg-[#FDEDED] border border-[#F2CACA] rounded-[14px] p-3.5 text-[11.5px] text-[#8A4141]">
              Không tải được tài liệu: {error}
            </div>
          )}
          {!loading &&
            doc?.sections.map((section) => (
              <article key={section.id} className="p-4 rounded-[12px] border border-[#ECEAE5] bg-white flex flex-col gap-2">
                <h5 className="font-bold text-[12.5px] text-[#191817]">
                  §{section.number} {section.heading}
                </h5>
                {isIncomplete(section) ? (
                  <div className="text-[11.5px] text-[#A8A49C] italic">chưa hoàn thiện</div>
                ) : section.blocks.length > 0 ? (
                  section.blocks.map((block, i) => <BlockView key={i} block={block} projectId={projectId} />)
                ) : (
                  <div className="text-[11.5px] text-[#A8A49C] italic">chưa hoàn thiện</div>
                )}
              </article>
            ))}
        </div>
      </main>
    </div>
  );
}
