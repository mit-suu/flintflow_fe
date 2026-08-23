"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";

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
  onHardDelete: (p: Project) => void;
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
      gradient: "linear-gradient(135deg,#F6D5D5,#E89090 50%,#B03030)",
      badge: "Cần làm rõ",
      badgeColor: "#B03030",
      nextBg: "#FBF4E4",
      nextText: "#8A6D1F",
      arrow: "#E8A23D",
    };
  }
  if (progressPercent >= 80) {
    return {
      gradient: "linear-gradient(135deg,#DDF3E4,#9BD9B4 45%,#2FA45C)",
      badge: "Sẵn sàng",
      badgeColor: "#1F7A45",
      nextBg: "#EAF6EE",
      nextText: "#1F7A45",
      arrow: "#2FA45C",
    };
  }
  if (progressPercent >= 40) {
    return {
      gradient: "linear-gradient(135deg,#C7B8F5,#7C74F0 50%,#4F46E5)",
      badge: "Đang phân tích",
      badgeColor: "#4F46E5",
      nextBg: "#F4F3FE",
      nextText: "#3B34B0",
      arrow: "#4F46E5",
    };
  }
  return {
    gradient: "linear-gradient(135deg,#E4E1DC,#C9C5BD 50%,#8A867E)",
    badge: "Bản nháp",
    badgeColor: "#6B6862",
    nextBg: "#F5F3F0",
    nextText: "#6B6862",
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

export default function ProjectCard({ project, onRename, onDelete, onHardDelete }: Props) {
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
    <div className="bg-white rounded-[16px] border border-[#ECEAE5] flex flex-col relative hover:shadow-[0_12px_32px_rgba(25,24,23,0.08)] transition-all group overflow-visible">
      {/* 3-dot menu */}
      <div ref={menuRef} className="absolute top-2.5 right-2.5 z-20">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm text-[#6B6862] font-bold text-sm hover:bg-white shadow-[0_2px_8px_rgba(25,24,23,0.12)] transition-all cursor-pointer"
        >
          ⋮
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-[12px] border border-[#ECEAE5] py-1.5 flex flex-col min-w-[148px] shadow-[0_12px_28px_rgba(25,24,23,0.14)] z-30">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onRename(project);
              }}
              className="flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-semibold text-[#33312D] hover:bg-[#FAF9F7] transition-colors w-full text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#6B6862]">
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
              className="flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-semibold text-[#8A4141] hover:bg-[#FDEDED] transition-colors w-full text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">archive</span>
              Lưu trữ
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onHardDelete(project);
              }}
              className="flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-semibold text-[#B03030] hover:bg-[#FDEDED] transition-colors w-full text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Xoá vĩnh viễn
            </button>
          </div>
        )}
      </div>

      <Link href={`/projects/${project._id}`} className="flex flex-col flex-1 rounded-[16px] overflow-hidden">
        {/* Cover */}
        <div
          className="h-[88px] relative shrink-0"
          style={{ background: variant.gradient }}
        >
          {/* Status badge */}
          <div className="absolute left-3.5 -bottom-2.5 bg-white border border-[#ECEAE5] rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-[0_2px_8px_rgba(25,24,23,0.06)] flex items-center gap-1.5"
            style={{ color: variant.badgeColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: variant.badgeColor }} />
            {variant.badge}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-2 flex-1 p-4 pt-5">
          <div className="text-[11px] text-[#8A867E]">
            {timeAgo(project.updatedAt)} · {project.domain || "general"}
          </div>

          <div className="font-extrabold text-[#191817] text-[14.5px] leading-snug line-clamp-1">
            {project.name}
          </div>

          {/* Next step chip */}
          <div
            className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 mt-auto text-[11.5px] font-semibold"
            style={{ background: variant.nextBg, color: variant.nextText }}
          >
            <span style={{ color: variant.arrow, fontWeight: 800 }}>→</span>
            <span className="truncate">{stepLabel}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
