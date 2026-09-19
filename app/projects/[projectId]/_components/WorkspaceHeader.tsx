"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import Logo from "../../../../components/Logo";
import type { Project } from "@/types/project";
import type { User } from "@/types/user";

interface WorkspaceHeaderProps {
  project: Project | null;
  user: User | null;
  /** Phiên bản baseline mới nhất trong `spine.baselines[]`; `null` khi chưa ký baseline. */
  baselineVersion?: string | null;
  onExportClick?: () => void;
  onLogout: () => void;
}

export default function WorkspaceHeader({
  project,
  user,
  baselineVersion = null,
  onExportClick,
  onLogout,
}: WorkspaceHeaderProps) {
  const t = useTranslations("workspace.header");

  return (
    <header className="bg-white border-b border-[#ECEAE5] px-6 py-2 flex items-center justify-between shrink-0 h-[58px] z-20">
      <div className="flex items-center gap-3">
        <Logo sizeClassName="w-7 h-7" theme="light" showText={false} href="/home" />
        <div className="flex items-center text-[13px] text-[#8A867E] gap-1.5">
          <Link
            href="/home"
            className="hover:text-[#191817] font-semibold transition-colors"
          >
            {t("projects")}
          </Link>
          <span className="text-[#D6D2CB]">/</span>
          <span className="font-bold text-[#191817] truncate max-w-[220px]">
            {project?.name || t("untitled")}
          </span>
        </div>

        {project?.domain && (
          <div className="ml-2 px-2.5 py-0.5 rounded-full bg-[#EEF1FB] text-[#3B4FA8] text-[11px] font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
            domain: {project.domain}
          </div>
        )}

        {baselineVersion && (
          <div className="px-2.5 py-0.5 rounded-full bg-[#E9F7EE] text-[#1F7A45] text-[11px] font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1F7A45]" />
            Baseline {baselineVersion}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <LocaleSwitcher tone="light" />
        {user && (
          <div className="flex items-center px-3 py-1 rounded-full bg-[#F0EEEA] text-[#191817] text-[12px] font-semibold gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
            {user.balance ?? 0} credits
          </div>
        )}

        <button
          type="button"
          onClick={onExportClick}
          title={t("exportHint")}
          className="px-3.5 py-1 rounded-full text-[12px] font-bold flex items-center gap-1 transition-all bg-[#191817] text-white hover:bg-[#33312D] cursor-pointer shadow-sm"
        >
          <span>Export</span>
          <span className="text-[11px]">↗</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          title={t("logout")}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-bold text-[#B03030] hover:bg-[#FDEDED] border border-[#F2CACA] transition-colors cursor-pointer"
        >
          <span className="text-sm leading-none">⏻</span>
          <span className="hidden md:inline">{t("logout")}</span>
        </button>
      </div>
    </header>
  );
}
