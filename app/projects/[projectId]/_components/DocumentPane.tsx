"use client";

import { useState } from "react";
import {
  SRS_CHAPTERS,
  SECTION_TYPE_LABELS,
  SectionType,
  WorkspacePhase,
} from "../../../../lib/constants/section-types";
import { SectionItem } from "./PhaseNavBar";

interface DocumentPaneProps {
  projectName?: string;
  sections: SectionItem[];
  workspacePhase: WorkspacePhase;
  onSaveSectionContent?: (type: SectionType, content: string) => Promise<void>;
  onAssembleSRS?: () => void;
}

export default function DocumentPane({
  projectName = "Dự án",
  sections,
  onSaveSectionContent,
  onAssembleSRS,
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

  const [editingSectionType, setEditingSectionType] =
    useState<SectionType | null>(null);
  const [editBuffer, setEditBuffer] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);
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

  const startEdit = (type: SectionType, content: string) => {
    setEditingSectionType(type);
    setEditBuffer(content || "");
  };

  const saveEdit = async (type: SectionType) => {
    if (!onSaveSectionContent) return;
    try {
      setSavingEdit(true);
      await onSaveSectionContent(type, editBuffer);
      setEditingSectionType(null);
    } catch (err: unknown) {
      alert("Lưu đặc tả thất bại: " + (err instanceof Error ? err.message : "Lỗi chưa xác định"));
    } finally {
      setSavingEdit(false);
    }
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
    <section className="flex-1 bg-white flex flex-col min-w-[480px] overflow-hidden">
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
                    const isEditing = editingSectionType === secType;
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

                          <div className="flex items-center gap-2">
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

                            {hasContent && !isEditing && (
                              <button
                                type="button"
                                onClick={() =>
                                  startEdit(secType, sec?.content || "")
                                }
                                className="text-[11px] font-bold text-[#4F46E5] hover:underline cursor-pointer ml-1"
                              >
                                Sửa
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Content render or edit mode */}
                        {isEditing ? (
                          <div className="flex flex-col gap-2 pt-1">
                            <textarea
                              value={editBuffer}
                              onChange={(e) => setEditBuffer(e.target.value)}
                              rows={8}
                              className="w-full p-3 text-[12px] font-mono text-[#191817] bg-white border border-[#DDD9F6] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingSectionType(null)}
                                className="px-3 py-1 rounded-full text-[11px] font-semibold text-[#6B6862] hover:bg-[#F0EEEA] cursor-pointer"
                              >
                                Huỷ
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEdit(secType)}
                                disabled={savingEdit}
                                className="px-3.5 py-1 rounded-full btn-gradient-primary text-white text-[11px] font-bold cursor-pointer"
                              >
                                {savingEdit ? "Đang lưu…" : "Lưu thay đổi"}
                              </button>
                            </div>
                          </div>
                        ) : hasContent ? (
                          <div className="p-3 bg-white border border-[#ECEAE5] rounded-[8px] text-[12px] text-[#33312D] font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {sec?.content}
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

            <div className="flex-1 overflow-y-auto p-4 bg-[#FAF9F7] rounded-[12px] border border-[#ECEAE5] font-mono text-[12px] text-[#191817] leading-relaxed whitespace-pre-wrap">
              {getFullSrsMarkdown()}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
