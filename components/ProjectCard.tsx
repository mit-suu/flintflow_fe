"use client";

import { useRef, useEffect, useState } from "react";

export interface Project {
  _id: string;
  name: string;
  domain?: string | null;
  status: "active" | "archived";
  currentStep: string;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  project: Project;
  onRename: (p: Project) => void;
  onDelete: (p: Project) => void;
}

const STEP_LABELS: Record<string, string> = {
  step_1: "Mô tả ý tưởng dự án",
  step_2: "AI đặt câu hỏi làm rõ",
  step_3: "Phân tích yêu cầu",
  step_4: "Sinh đặc tả sections",
  step_5: "Review & chỉnh sửa",
  step_6: "Xác minh chất lượng",
  step_7: "Export handoff cho dev",
  blocked: "Cần trả lời câu hỏi mở",
};

type Variant = {
  gradient: string;
  badge: string;
  badgeColor: string;
  nextBg: string;
  nextText: string;
  arrow: string;
};

function getVariant(progressPercent: number, currentStep: string): Variant {
  if (currentStep === "blocked") {
    return {
      gradient: "linear-gradient(120deg,#F6D5D5,#E89090 50%,#C73E3E)",
      badge: "Blocked",
      badgeColor: "#B03030",
      nextBg: "#FDF6EC",
      nextText: "#8A6D1F",
      arrow: "#B8860B",
    };
  }
  if (progressPercent >= 80) {
    return {
      gradient: "linear-gradient(120deg,#DDF3E4,#9BD9B4 45%,#4FAE78)",
      badge: "PRD ready",
      badgeColor: "#1F7A45",
      nextBg: "#F4F3FE",
      nextText: "#3B34B0",
      arrow: "#4F46E5",
    };
  }
  if (progressPercent >= 40) {
    return {
      gradient: "linear-gradient(120deg,#C7B8F5,#7C74F0 50%,#4F46E5)",
      badge: "Brief complete",
      badgeColor: "#3B4FA8",
      nextBg: "#F4F3FE",
      nextText: "#3B34B0",
      arrow: "#4F46E5",
    };
  }
  return {
    gradient: "linear-gradient(120deg,#E4E1DC,#C9C5BD 50%,#A8A49C)",
    badge: "Draft",
    badgeColor: "#6B6862",
    nextBg: "#F4F3FE",
    nextText: "#3B34B0",
    arrow: "#4F46E5",
  };
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  if (seconds < 172800) return "Hôm qua";
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
  return `${Math.floor(seconds / 604800)} tuần trước`;
}

export default function ProjectCard({ project, onRename, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const variant = getVariant(project.progressPercent, project.currentStep);
  const stepLabel = STEP_LABELS[project.currentStep] ?? project.currentStep;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      className="bg-white rounded-[18px] flex flex-col"
      style={{
        overflow: "visible",
        boxShadow: "0 4px 16px rgba(25,24,23,0.05)",
      }}
    >
      {/* Cover */}
      <div
        className="h-[104px] relative flex-shrink-0 rounded-t-[18px]"
        style={{ background: variant.gradient, overflow: "visible" }}
      >
        {/* 3-dot menu */}
        <div ref={menuRef} className="absolute top-3 right-3 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-[#6B6862] font-extrabold text-lg hover:bg-gray-50 transition-colors"
            style={{ boxShadow: "0 4px 12px rgba(25,24,23,0.12)" }}
          >
            ⋮
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 bg-white rounded-[14px] py-1.5 flex flex-col min-w-[152px] z-20"
              style={{ boxShadow: "0 8px 28px rgba(25,24,23,0.15)" }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onRename(project);
                }}
                className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] font-semibold text-[#33312D] hover:bg-[#F5F3F0] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-[#6B6862]">
                  edit
                </span>
                Đổi tên
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(project);
                }}
                className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] font-semibold text-[#C73E3E] hover:bg-[#FDF0F0] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">archive</span>
                Lưu trữ
              </button>
            </div>
          )}
        </div>

        {/* Status badge */}
        <div
          className="absolute left-4 bg-white rounded-full px-3 py-[5px] text-[11.5px] font-bold whitespace-nowrap"
          style={{
            bottom: "-14px",
            color: variant.badgeColor,
            boxShadow: "0 4px 12px rgba(25,24,23,0.1)",
          }}
        >
          ● {variant.badge}
        </div>
      </div>

      {/* Body */}
      <div
        className="flex flex-col gap-[10px] flex-1"
        style={{ padding: "24px 18px 18px" }}
      >
        <div className="text-[11.5px] text-[#8A867E]">
          {timeAgo(project.updatedAt)} · {project.domain || "general"}
        </div>

        <div
          className="font-bold text-[#191817] text-[15px] leading-snug"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {project.name}
        </div>

        {/* Next step chip */}
        <div
          className="flex items-center gap-2 rounded-[10px] px-3 py-[9px] mt-auto"
          style={{ background: variant.nextBg }}
        >
          <span style={{ color: variant.arrow, fontWeight: 700 }}>→</span>
          <span
            className="text-[12px] font-semibold leading-tight"
            style={{ color: variant.nextText }}
          >
            {stepLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
