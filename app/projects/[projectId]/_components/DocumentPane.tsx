"use client";

import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  SRS_CHAPTERS,
  SECTION_TYPE_LABELS,
  SectionType,
} from "../../../../lib/constants/section-types";
import type { SectionItem } from "@/types/document";

interface DocumentPaneProps {
  projectName?: string;
  sections: SectionItem[];
}

// Style cho markdown render (không dùng plugin typography)
const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-[15px] font-extrabold text-[#191817] mt-3 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[14px] font-extrabold text-[#191817] mt-3 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[13px] font-bold text-[#191817] mt-2.5 mb-1.5 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-[12.5px] font-bold text-[#191817] mt-2 mb-1 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-[#4F46E5] underline">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#DDD9F6] pl-3 text-[#6B6862] mb-2">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="font-mono text-[11px] bg-[#F5F3F0] px-1 py-0.5 rounded">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="font-mono text-[11px] bg-[#F5F3F0] p-2.5 rounded-[6px] overflow-x-auto mb-2">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-3 border-[#ECEAE5]" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="w-full border-collapse text-[11.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-[#ECEAE5] bg-[#FAF9F7] px-2 py-1 text-left font-bold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-[#ECEAE5] px-2 py-1 align-top">{children}</td>,
};

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

/** Document pane chỉ đọc: nội dung SRS chỉ đổi qua step/chat, không sửa trực tiếp tại đây. */
export default function DocumentPane({
  projectName = "Dự án",
  sections,
}: DocumentPaneProps) {
  const [expandedChapters, setExpandedChapters] = useState<
    Record<string, boolean>
  >({
    ch1: true,
    ch2: true,
    ch3: true,
    ch4: true,
    ch5: true,
  });

  const [showFullDocModal, setShowFullDocModal] = useState(false);

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const getSectionData = (type: SectionType) => {
    return sections.find((s) => s.type === type);
  };

  // Compile full SRS Document text for preview / copy
  const getFullSrsMarkdown = (): string => {
    let doc = `# Software Requirement Specification (SRS)\n`;
    doc += `## Dự án: ${projectName}\n`;
    doc += `*Chuẩn cấu trúc: FPT Capstone Report 3 / ISO 29148*\n\n---\n\n`;

    SRS_CHAPTERS.forEach((ch) => {
      doc += `# ${ch.title}\n\n`;
      ch.sections.forEach((type) => {
        const sec = getSectionData(type);
        const label = SECTION_TYPE_LABELS[type] || type;
        doc += `### ${label}\n\n`;
        if (sec && sec.content) {
          doc += `${sec.content}\n\n`;
        } else {
          doc += `*Chưa có nội dung đặc tả cho mục này.*\n\n`;
        }
      });
      doc += `---\n\n`;
    });

    return doc;
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(getFullSrsMarkdown());
    alert("Đã sao chép toàn bộ tài liệu SRS vào clipboard!");
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([getFullSrsMarkdown()], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SRS_${projectName.replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex-1 bg-white flex flex-col min-w-[320px] overflow-hidden">
      {/* Top Header of Document Pane */}
      <div className="px-6 py-3 border-b border-[#ECEAE5] flex items-center justify-between shrink-0 h-[52px] bg-white">
        <div className="flex items-center gap-2.5">
          <h3 className="font-extrabold text-[13.5px] text-[#191817]">
            SRS — {projectName}
          </h3>
          <span className="text-[10.5px] text-[#8A867E] bg-[#F5F3F0] px-2 py-0.5 rounded-full font-mono">
            source of truth
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFullDocModal(true)}
            className="px-3 py-1 rounded-full bg-[#FAF9F7] hover:bg-[#F4F3FE] border border-[#ECEAE5] hover:border-[#DDD9F6] text-[#4F46E5] text-[11.5px] font-bold transition-all cursor-pointer"
          >
            📄 Xem toàn văn SRS
          </button>
        </div>
      </div>

      {/* Document Tree Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#FAF9F7]">
        {SRS_CHAPTERS.map((ch) => {
          const isExpanded = expandedChapters[ch.id];
          const chapterSections = ch.sections;
          const acceptedCount = chapterSections.filter(
            (t) => getSectionData(t)?.status === "accepted"
          ).length;
          const hasContentCount = chapterSections.filter(
            (t) => Boolean(getSectionData(t)?.content)
          ).length;
          const isAllAccepted =
            acceptedCount === chapterSections.length &&
            chapterSections.length > 0;

          return (
            <div
              key={ch.id}
              className="bg-white border border-[#ECEAE5] rounded-[16px] overflow-hidden shadow-2xs transition-all"
            >
              {/* Chapter Header Bar */}
              <div
                onClick={() => toggleChapter(ch.id)}
                className="px-5 py-3.5 bg-white hover:bg-[#FAF9F7] flex items-center justify-between cursor-pointer select-none border-b border-[#ECEAE5]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm text-[#8A867E] transition-transform">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                  <h4 className="font-extrabold text-[13.5px] text-[#191817]">
                    {ch.title}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full ${
                      isAllAccepted
                        ? "bg-[#E9F7EE] text-[#1F7A45] border border-[#BFE6CE]"
                        : hasContentCount > 0
                        ? "bg-[#F4F3FE] text-[#3B34B0] border border-[#DDD9F6]"
                        : "bg-[#F0EEEA] text-[#8A867E]"
                    }`}
                  >
                    {isAllAccepted
                      ? "✓ ĐÃ NGHIỆM THU ĐỦ"
                      : `${acceptedCount}/${chapterSections.length} mục`}
                  </span>
                </div>
              </div>

              {/* Sub-sections list */}
              {isExpanded && (
                <div className="p-5 space-y-4 bg-white">
                  {chapterSections.map((secType) => {
                    const sec = getSectionData(secType);
                    const label = SECTION_TYPE_LABELS[secType] || secType;
                    const hasContent = Boolean(sec && sec.content);
                    const isAccepted = sec?.status === "accepted";

                    return (
                      <div
                        key={secType}
                        className="p-4 rounded-[12px] border border-[#ECEAE5] bg-[#FAF9F7] flex flex-col gap-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isAccepted
                                  ? "bg-[#1F7A45]"
                                  : hasContent
                                  ? "bg-[#4F46E5]"
                                  : "bg-[#D6D2CB]"
                              }`}
                            />
                            <h5 className="font-bold text-[12.5px] text-[#191817]">
                              {label}
                            </h5>
                          </div>

                          <span
                            className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${
                              isAccepted
                                ? "bg-[#E9F7EE] text-[#1F7A45]"
                                : hasContent
                                ? "bg-[#F4F3FE] text-[#3B34B0]"
                                : "bg-[#F0EEEA] text-[#8A867E]"
                            }`}
                          >
                            {isAccepted
                              ? "Accepted"
                              : hasContent
                              ? "Draft"
                              : "Chưa sinh"}
                          </span>
                        </div>

                        {/* Content render (read-only) */}
                        {hasContent ? (
                          <div className="p-3 bg-white border border-[#ECEAE5] rounded-[8px] text-[12px] text-[#33312D] leading-relaxed max-h-64 overflow-y-auto">
                            <MarkdownContent content={sec?.content || ""} />
                          </div>
                        ) : (
                          <div className="p-3 bg-white/60 border border-dashed border-[#E4E1DC] rounded-[8px] text-[11.5px] text-[#A8A49C] italic">
                            Chưa có nội dung đặc tả. Vui lòng chuyển sang Phase
                            tương ứng để sinh.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Full Document Modal */}
      {showFullDocModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[20px] p-6 max-w-4xl w-full h-[85vh] border border-[#ECEAE5] shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECEAE5]">
              <div className="flex items-center gap-2">
                <span className="text-[#4F46E5] text-lg">📄</span>
                <h3 className="font-extrabold text-[16px] text-[#191817]">
                  Toàn văn tài liệu SRS — {projectName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="px-3.5 py-1.5 rounded-full border border-[#ECEAE5] hover:bg-[#FAF9F7] text-[11.5px] font-bold text-[#4B4842] cursor-pointer"
                >
                  📋 Sao chép Markdown
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  className="px-3.5 py-1.5 rounded-full btn-gradient-primary text-white text-[11.5px] font-bold cursor-pointer"
                >
                  📥 Tải file .md
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullDocModal(false)}
                  className="p-1.5 hover:bg-[#F5F3F0] rounded-full text-[#8A867E] hover:text-[#191817] cursor-pointer ml-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#FAF9F7] rounded-[12px] border border-[#ECEAE5] text-[12.5px] text-[#191817] leading-relaxed">
              <MarkdownContent content={getFullSrsMarkdown()} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
