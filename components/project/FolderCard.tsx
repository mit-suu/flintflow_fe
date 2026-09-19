"use client";

import DropdownMenu from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import type { Folder, FolderColor } from "@/types/folder";

/** Màu thư mục → class token: thân (gradient nhạt), tab phía sau, ô chọn màu. */
export const FOLDER_COLORS: Record<FolderColor, { label: string; body: string; tab: string; swatch: string }> = {
  violet: { label: "Tím", body: "bg-gradient-to-br from-primary-soft to-brand-100", tab: "bg-brand-200", swatch: "bg-brand-300" },
  blue: { label: "Xanh dương", body: "bg-gradient-to-br from-info-soft to-info-border", tab: "bg-info-border", swatch: "bg-info" },
  amber: { label: "Vàng", body: "bg-gradient-to-br from-accent-gold-soft to-accent-gold-border", tab: "bg-accent-gold-border", swatch: "bg-accent-gold" },
  green: { label: "Xanh lá", body: "bg-gradient-to-br from-success-soft to-success-border", tab: "bg-success-border", swatch: "bg-success-dark" },
  rose: { label: "Hồng", body: "bg-gradient-to-br from-error-container to-error-border", tab: "bg-error-border", swatch: "bg-error" },
};

export const FOLDER_COLOR_ORDER = Object.keys(FOLDER_COLORS) as FolderColor[];

interface FolderCardProps {
  folder: Folder;
  onOpen: (folder: Folder) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}

/** Thẻ thư mục kiểu Floe: tab phía sau, thân gradient theo màu, tên (mono), vạch ngăn, số dự án. */
export default function FolderCard({ folder, onOpen, onRename, onDelete }: FolderCardProps) {
  const color = FOLDER_COLORS[folder.color] ?? FOLDER_COLORS.violet;
  return (
    <article className="relative pt-3">
      {/* Tab thư mục phía sau */}
      <span aria-hidden className={`absolute left-3 top-0 h-7 w-[46%] rounded-t-[14px] ${color.tab}`} />
      <span aria-hidden className={`absolute left-1.5 right-1.5 top-2 h-8 rounded-t-[18px] opacity-60 ${color.tab}`} />

      <button
        type="button"
        onClick={() => onOpen(folder)}
        className={`relative w-full min-h-[118px] flex flex-col gap-3 text-left rounded-[18px] px-5 pt-5 pb-4 transition-shadow hover:shadow-[0_14px_30px_rgba(25,24,23,0.08)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${color.body}`}
      >
        <span className="font-mono text-[15px] font-medium text-on-surface line-clamp-1 pr-10">{folder.name}</span>
        <span aria-hidden className="h-px bg-on-surface/10" />
        <span className="flex items-center justify-between text-[12px] text-on-surface-variant">
          <Icon name="folder" size={16} className="text-on-surface-muted" />
          <span>{folder.projectCount} dự án</span>
        </span>
      </button>

      <div className="absolute right-4 top-6 z-20">
        <DropdownMenu
          items={[
            { label: "Đổi tên", icon: "pencil", onSelect: () => onRename(folder) },
            { label: "Xoá thư mục", icon: "trash", tone: "danger", onSelect: () => onDelete(folder) },
          ]}
          trigger={(props) => (
            <IconButton
              {...props}
              icon="more"
              size="sm"
              label={`Tuỳ chọn cho thư mục ${folder.name}`}
              className="bg-surface-container-lowest/70 border border-outline-variant hover:bg-surface-container-lowest"
            />
          )}
        />
      </div>
    </article>
  );
}

/** Ô viền đứt "+ Thư mục mới" ở cuối hàng thư mục. */
export function NewFolderTile({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="pt-3">
      <button
        type="button"
        onClick={onCreate}
        className="w-full min-h-[118px] rounded-[18px] border-2 border-dashed border-outline flex flex-col items-center justify-center gap-1.5 text-[12.5px] font-semibold text-on-surface-muted hover:border-outline-purple hover:text-primary hover:bg-surface-container-lowest transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon name="plus" size={18} />
        Thư mục mới
      </button>
    </div>
  );
}
