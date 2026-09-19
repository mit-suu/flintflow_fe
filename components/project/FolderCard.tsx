"use client";

import { useState } from "react";
import DropdownMenu from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import type { Folder, FolderColor } from "@/types/folder";
import { PROJECT_DRAG_TYPE } from "./ProjectCard";

/**
 * Màu thư mục → class token (màu trơn): thân trước, tấm lưng phía sau, tab (SVG tô bằng `currentColor` ⇒ class `text-*`),
 * ô chọn màu. Class viết đủ để Tailwind sinh ra.
 */
export const FOLDER_COLORS: Record<FolderColor, { label: string; body: string; back: string; tab: string; swatch: string }> = {
  violet: { label: "Tím", body: "bg-brand-50", back: "bg-brand-200", tab: "text-brand-200", swatch: "bg-brand-300" },
  blue: { label: "Xanh dương", body: "bg-info-soft", back: "bg-info-border", tab: "text-info-border", swatch: "bg-info" },
  amber: { label: "Vàng", body: "bg-accent-gold-soft", back: "bg-accent-gold-border", tab: "text-accent-gold-border", swatch: "bg-accent-gold" },
  green: { label: "Xanh lá", body: "bg-success-soft", back: "bg-success-border", tab: "text-success-border", swatch: "bg-success-dark" },
  rose: { label: "Hồng", body: "bg-error-container", back: "bg-error-border", tab: "text-error-border", swatch: "bg-error" },
};

export const FOLDER_COLOR_ORDER = Object.keys(FOLDER_COLORS) as FolderColor[];

interface FolderCardProps {
  folder: Folder;
  onOpen: (folder: Folder) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  /** Có ⇒ nhận card dự án kéo thả vào (desktop; menu ⋮ của card là cách thay thế). */
  onDropProject?: (folder: Folder, projectId: string) => void;
}

/**
 * Thẻ thư mục kiểu Floe: phía sau là bóng thư mục (tab bên trái đổ dốc chữ S xuống tấm lưng), phía trước là thân màu
 * nhạt hơn đặt thấp xuống để lộ một dải lưng; tên (mono), vạch ngăn, số dự án. Chỗ avatar thành viên để trống tới khi
 * có tổ chức.
 */
export default function FolderCard({ folder, onOpen, onRename, onDelete, onDropProject }: FolderCardProps) {
  const color = FOLDER_COLORS[folder.color] ?? FOLDER_COLORS.violet;
  const [dragOver, setDragOver] = useState(false);
  const acceptsDrag = (e: React.DragEvent) => Boolean(onDropProject) && e.dataTransfer.types.includes(PROJECT_DRAG_TYPE);

  return (
    <article
      className="relative pt-[22px]"
      data-drop-target={dragOver || undefined}
      onDragOver={(e) => {
        if (!acceptsDrag(e)) return;
        e.preventDefault(); // cho phép thả
        e.dataTransfer.dropEffect = "move";
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        // Chỉ tắt khi rời hẳn thẻ, không phải khi đi qua phần tử con
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
      }}
      onDrop={(e) => {
        if (!acceptsDrag(e)) return;
        e.preventDefault();
        setDragOver(false);
        const projectId = e.dataTransfer.getData(PROJECT_DRAG_TYPE);
        if (projectId) onDropProject?.(folder, projectId);
      }}
    >
      {/* Bóng thư mục phía sau: tấm lưng (góc trái trên do tab che) + tab kích thước cố định, cạnh phải dốc chữ S */}
      <span aria-hidden className={`absolute inset-x-0 top-[14px] bottom-0 rounded-[20px] rounded-tl-none ${color.back}`} />
      <svg aria-hidden viewBox="0 0 128 24" className={`absolute left-0 top-0 h-[24px] w-[128px] ${color.tab}`} fill="currentColor">
        <path d="M0 24V16Q0 0 16 0H84C96 0 100 5 105 9.5C110 14 114 14 128 14V24Z" />
      </svg>

      <button
        type="button"
        onClick={() => onOpen(folder)}
        className={`relative w-full min-h-[104px] flex flex-col gap-3 text-left rounded-[20px] px-4 pt-4 pb-3.5 transition-[box-shadow,transform] hover:shadow-[0_14px_30px_rgba(25,24,23,0.08)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${color.body} ${
          dragOver ? "ring-2 ring-primary ring-offset-2 ring-offset-surface-container-lowest scale-[1.02]" : ""
        }`}
      >
        <span className="font-mono text-[14.5px] font-medium text-on-surface line-clamp-1 pr-11">{folder.name}</span>
        <span aria-hidden className="h-px bg-on-surface/10" />
        <span className="flex items-center justify-end text-[12px] text-on-surface-variant">
          {/* Trái: chỗ avatar thành viên — thêm khi có tổ chức */}
          <span>{folder.projectCount} dự án</span>
        </span>
      </button>

      <div className="absolute right-3.5 top-[35px] z-20">
        <DropdownMenu
          items={[
            { label: "Đổi tên", icon: "pencil", onSelect: () => onRename(folder) },
            { label: "Xoá thư mục", icon: "trash", tone: "danger", onSelect: () => onDelete(folder) },
          ]}
          trigger={(props) => (
            <IconButton
              {...props}
              icon="more"
              size="pill"
              label={`Tuỳ chọn cho thư mục ${folder.name}`}
              className="border border-on-surface/15 hover:bg-surface-container-lowest/60 [&_svg]:rotate-90"
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
    <div className="pt-[22px]">
      <button
        type="button"
        onClick={onCreate}
        className="w-full min-h-[104px] rounded-[20px] border-2 border-dashed border-outline flex flex-col items-center justify-center gap-1.5 text-[12.5px] font-semibold text-on-surface-muted hover:border-outline-purple hover:text-primary hover:bg-surface-container-lowest transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon name="plus" size={18} />
        Thư mục mới
      </button>
    </div>
  );
}
