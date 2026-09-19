"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import AuthGuard from "@/components/AuthGuard";
import Logo from "@/components/Logo";
import type { Project } from "@/types/project";
import { IMPORT_DONE_STATUSES, IMPORT_STATUS_LABELS } from "./labels";

export type Mode1Tab = "document" | "import" | "gap-report" | "change-requests";

interface Mode1ShellProps {
  projectId: string;
  project: Project | null;
  credits: number | null;
  active: Mode1Tab;
  /** Lỗi tải project — hiện thay nội dung, không để trang trắng. */
  error?: string | null;
  children: ReactNode;
}

const TABS: { id: Mode1Tab; label: string; path: string; needsBaseline: boolean }[] = [
  { id: "import", label: "Nhập SRS", path: "/import", needsBaseline: false },
  { id: "gap-report", label: "Gap report", path: "/gap-report", needsBaseline: true },
  { id: "document", label: "Tài liệu & version", path: "", needsBaseline: true },
  { id: "change-requests", label: "Change request", path: "/change-requests", needsBaseline: true },
];

/**
 * Khung chung của mọi trang mode 1 (upload SRS có sẵn rồi sửa): header + tab. Tab cần baseline v0 bị khoá
 * tới khi import xong — trạng thái đọc từ `project.import_state` do BE trả, FE không tự suy.
 */
export default function Mode1Shell({ projectId, project, credits, active, error, children }: Mode1ShellProps) {
  const importState = project?.import_state ?? null;
  const hasBaseline = importState !== null && IMPORT_DONE_STATUSES.includes(importState);

  return (
    <AuthGuard>
      <div className="h-screen flex flex-col overflow-hidden bg-[#F5F3F0] font-sans">
        <header className="bg-white border-b border-[#ECEAE5] px-6 py-2 flex items-center justify-between shrink-0 h-[58px] z-20">
          <div className="flex items-center gap-3 min-w-0">
            <Logo variant="icon" sizeClassName="w-7 h-7" theme="light" href="/home" />
            <div className="flex items-center text-[13px] text-[#8A867E] gap-1.5 min-w-0">
              <Link href="/home" className="hover:text-[#191817] font-semibold transition-colors">
                Dự án
              </Link>
              <span className="text-[#D6D2CB]">/</span>
              <span className="font-bold text-[#191817] truncate max-w-[260px]">{project?.name ?? "Đang tải…"}</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#F4F3FE] text-[#3B34B0] text-[11px] font-bold shrink-0">
              Upload SRS có sẵn
            </span>
            {importState && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#F0EEEA] text-[#4B4842] text-[11px] font-semibold shrink-0">
                {IMPORT_STATUS_LABELS[importState]}
              </span>
            )}
          </div>
          <div className="flex items-center px-3 py-1 rounded-full bg-[#F0EEEA] text-[#191817] text-[12px] font-semibold gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
            {credits ?? "…"} credits
          </div>
        </header>

        <nav className="bg-white border-b border-[#ECEAE5] px-6 flex items-center gap-1 shrink-0" aria-label="Mode 1">
          {TABS.map((tab) => {
            const disabled = tab.needsBaseline && !hasBaseline;
            const className = `px-3.5 py-2.5 text-[12.5px] font-bold border-b-2 transition-colors ${
              active === tab.id
                ? "border-[#4F46E5] text-[#191817]"
                : disabled
                  ? "border-transparent text-[#C9C5BD] cursor-not-allowed"
                  : "border-transparent text-[#8A867E] hover:text-[#191817]"
            }`;
            return disabled ? (
              <span key={tab.id} className={className} title="Cần hoàn tất import (baseline 0.0) trước" aria-disabled="true">
                {tab.label}
              </span>
            ) : (
              <Link key={tab.id} href={`/projects/${projectId}${tab.path}`} className={className} aria-current={active === tab.id ? "page" : undefined}>
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 overflow-hidden flex">
          {error ? (
            <div className="m-6 flex-1 self-start bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] rounded-[12px] px-4 py-3 text-[12.5px]">
              {error}
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
