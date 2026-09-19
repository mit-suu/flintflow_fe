"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import type { Project } from "@/types/project";
import type { ProgressResponse } from "@/types/pipeline";
import { tStep, type Locale } from "@/lib/i18n";
import { IMPORT_DONE_STATUSES, IMPORT_STATUS_LABELS } from "@/app/projects/[projectId]/_components/mode1/labels";

interface Props {
  project: Project;
  /** `GET /projects/:id/progress`; `null` khi project chưa có Spine, `undefined` khi đang tải. */
  progress?: ProgressResponse | null;
  locale?: Locale;
  /** Mode 1: số change request đang mở; `undefined` khi chưa tải / không áp dụng. */
  openCrs?: number;
  onRename: (p: Project) => void;
  onDelete: (p: Project) => void;
  onHardDelete: (p: Project) => void;
}

type Variant = {
  gradient: string;
  badge: string;
  badgeColor: string;
  nextBg: string;
  nextText: string;
  arrow: string;
};

/**
 * T23: trạng thái thẻ đọc từ **readiness thật** của Spine, không phải phần trăm legacy trên document
 * Project (field section-based cũ, BE không còn cập nhật; T21 xoá).
 *
 * Thứ tự quyết định có chủ ý: **cờ đỏ thắng phần trăm**. Một tài liệu 90% section đã chấp nhận mà còn
 * khoá chết thì không "sẵn sàng" — đó đúng là điều kiện chặn baseline ở S-9.5.
 */
function getVariant(progress: ProgressResponse | null | undefined): Variant {
  if (progress && progress.readiness.red_open > 0) {
    return {
      gradient: "linear-gradient(135deg,#F6D5D5,#E89090 50%,#B03030)",
      badge: "Cần làm rõ",
      badgeColor: "#B03030",
      nextBg: "#FBF4E4",
      nextText: "#8A6D1F",
      arrow: "#E8A23D",
    };
  }
  const accepted = progress?.readiness.accepted_pct ?? 0;
  if (progress && accepted >= 80) {
    return {
      gradient: "linear-gradient(135deg,#DDF3E4,#9BD9B4 45%,#2FA45C)",
      badge: "Sẵn sàng",
      badgeColor: "#1F7A45",
      nextBg: "#EAF6EE",
      nextText: "#1F7A45",
      arrow: "#2FA45C",
    };
  }
  if (progress && accepted >= 40) {
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

/** Việc tiếp theo: step đang dở lấy từ registry. Chưa có Spine ⇒ nói thẳng là chưa bắt đầu. */
export function nextStepLabel(progress: ProgressResponse | null | undefined, locale: Locale = "vi"): string {
  if (progress === undefined) return "Đang tải…";
  const stepId = progress?.progress.current_step;
  if (!stepId) return "Chưa bắt đầu — mở để mô tả ý tưởng";
  return tStep(stepId, locale);
}

/**
 * Mode 1 (UC-14, UC-19): chưa import xong ⇒ trạng thái import; đã có baseline ⇒ số change request đang mở.
 * Trạng thái lấy từ `project.import_state` do BE trả.
 */
export function mode1NextLabel(project: Project, openCrs?: number): string {
  const state = project.import_state;
  if (!state) return "Chưa tải SRS lên — mở để upload .docx";
  if (!IMPORT_DONE_STATUSES.includes(state)) return `Nhập SRS: ${IMPORT_STATUS_LABELS[state]}`;
  if (openCrs === undefined) return IMPORT_STATUS_LABELS[state];
  return openCrs > 0 ? `${openCrs} change request đang mở` : IMPORT_STATUS_LABELS[state];
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  if (seconds < 172800) return "Hôm qua";
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
  return `${Math.floor(seconds / 604800)} tuần trước`;
}

export default function ProjectCard({ project, progress, locale = "vi", openCrs, onRename, onDelete, onHardDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const variant = getVariant(progress);
  const isImport = project.mode === "import";
  const stepLabel = isImport ? mode1NextLabel(project, openCrs) : nextStepLabel(progress, locale);

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
            {isImport && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#F4F3FE] text-[#3B34B0] font-bold">Upload SRS</span>}
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
