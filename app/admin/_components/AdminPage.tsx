"use client";

import type { ReactNode } from "react";

export function AdminTopBar({ trail, actions }: { trail: string[]; actions?: ReactNode }) {
  return (
    <div className="h-[58px] bg-white border-b border-[#E4E1DC] flex items-center px-6 gap-3.5 shrink-0 z-10">
      <div className="flex items-center gap-1.5 text-[13px] text-[#8A867E]">
        <span>Quản trị</span>
        {trail.map((part, idx) => (
          <span key={`${part}-${idx}`} className="flex items-center gap-1.5">
            <span className="text-[#D6D2CB]">/</span>
            <span className={idx === trail.length - 1 ? "text-[#191817] font-bold" : ""}>{part}</span>
          </span>
        ))}
      </div>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-4 py-3 rounded-[12px] text-xs font-medium">
      <span className="flex-1">{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="font-bold hover:opacity-75">
          ✕
        </button>
      )}
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-[#A8A49C] gap-3">
      <span className="w-5 h-5 rounded-full border-2 border-[#E4E1DC] border-t-[#4F46E5] ff-spinner shrink-0" />
      <span className="text-[13px] font-medium">{label}</span>
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="bg-white border border-[#ECEAE5] rounded-[16px] px-5 py-4">
      <div className="text-[11.5px] font-semibold text-[#8A867E]">{label}</div>
      <div className="text-[26px] font-extrabold text-[#191817] tracking-tight mt-1">{value}</div>
      {hint && <div className="text-[11px] text-[#A8A49C] mt-0.5">{hint}</div>}
    </div>
  );
}

export const tableHeadClass = "py-2.5 px-4 text-[11px] font-bold text-[#8A867E] uppercase tracking-[0.04em]";
export const tableCellClass = "py-3 px-4 text-[12.5px] text-[#33312D]";
export const inputClass =
  "h-9 px-3 rounded-[10px] border border-[#E4E1DC] bg-white text-[12.5px] text-[#191817] focus:outline-none focus:border-[#4F46E5]";
