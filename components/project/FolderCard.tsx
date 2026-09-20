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
 * Cặp màu pastel thân/lưng là token `folder-*` trong `app/globals.css` (chọn tay, không pha trắng); ô chọn màu = màu lưng.
 */
export const FOLDER_COLORS: Record<FolderColor, { label: string; body: string; back: string; tab: string; swatch: string }> = {
  // Tím dành riêng cho card dự án ⇒ thư mục không còn màu tím. BE vẫn có `violet` (hợp đồng API): thư mục cũ mang
  // màu này hiển thị như xanh dương và không có trong bảng chọn — xem `pickableFolderColor`.
  violet: { label: "Xanh dương", body: "bg-folder-blue", back: "bg-folder-blue-back", tab: "text-folder-blue-back", swatch: "bg-folder-blue-back" },
  blue: { label: "Xanh dương", body: "bg-folder-blue", back: "bg-folder-blue-back", tab: "text-folder-blue-back", swatch: "bg-folder-blue-back" },
  amber: { label: "Vàng", body: "bg-folder-amber", back: "bg-folder-amber-back", tab: "text-folder-amber-back", swatch: "bg-folder-amber-back" },
  green: { label: "Xanh lá", body: "bg-folder-green", back: "bg-folder-green-back", tab: "text-folder-green-back", swatch: "bg-folder-green-back" },
  rose: { label: "Hồng", body: "bg-folder-rose", back: "bg-folder-rose-back", tab: "text-folder-rose-back", swatch: "bg-folder-rose-back" },
};

/** Màu cho chọn trong dialog (không có tím). */
export const FOLDER_COLOR_ORDER: readonly FolderColor[] = ["blue", "amber", "green", "rose"];

/** Màu thư mục dùng trong bảng chọn: `violet` cũ quy về xanh dương (cách nó đang hiển thị). */
export const pickableFolderColor = (color: FolderColor): FolderColor => (color === "violet" ? "blue" : color);

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
 * nhạt hơn đặt thấp xuống để lộ một dải lưng; tên, vạch ngăn, số dự án. Chỗ avatar thành viên để trống tới khi
 * có tổ chức.
 */
export default function FolderCard({ folder, onOpen, onRename, onDelete, onDropProject }: FolderCardProps) {
  const color = FOLDER_COLORS[folder.color] ?? FOLDER_COLORS.blue;
  const [dragOver, setDragOver] = useState(false);
  const acceptsDrag = (e: React.DragEvent) => Boolean(onDropProject) && e.dataTransfer.types.includes(PROJECT_DRAG_TYPE);

  return (
    <article
      // Đang kéo dự án qua ⇒ cả thư mục (lưng + tab + thân) phóng to, đổ bóng theo đúng hình thư mục (drop-shadow, không ring), nổi trên tiêu đề mục dính (z-25)
      // Đang mở menu ⋮ ⇒ giữ nổi như lúc hover, để menu không bị nút ⋮ (z-20) của thẻ bên cạnh đè lên khi chuột rời thẻ
      className={`relative pt-[22px] transition-[transform,filter] duration-200 has-[[aria-expanded=true]]:z-[26] ${
        // Hover: bóng đổ theo hình cả thư mục (có tab) và nổi trên tiêu đề mục dính (z-25) để bóng không bị nền tiêu đề cắt
        dragOver
          ? "z-[26] scale-[1.04] drop-shadow-[0_14px_22px_rgba(25,24,23,0.16)]"
          : "hover:z-[26] hover:drop-shadow-[0_10px_18px_rgba(25,24,23,0.10)]"
      }`}
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
      <span aria-hidden className={`absolute inset-x-0 top-[14px] bottom-0 rounded-card rounded-tl-none ${color.back}`} />
      <svg aria-hidden viewBox="0 0 128 24" className={`absolute left-0 top-0 h-[24px] w-[128px] ${color.tab}`} fill="currentColor">
        <path d="M0 24V16Q0 0 16 0H84C96 0 100 5 105 9.5C110 14 114 14 128 14V24Z" />
      </svg>

      <button
        type="button"
        onClick={() => onOpen(folder)}
        className={`relative w-full min-h-[136px] flex flex-col gap-3 text-left rounded-card px-5 pt-5 pb-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${color.body}`}
      >
        <span className="text-[15px] font-semibold text-on-surface line-clamp-1 pr-11">{folder.name}</span>
        <span aria-hidden className="mt-auto h-px bg-on-surface/10" />
        <span className="flex items-center justify-end text-[12px] text-on-surface-variant">
          {/* Trái: chỗ avatar thành viên — thêm khi có tổ chức */}
          <span>{folder.projectCount} dự án</span>
        </span>
      </button>

      <div className="absolute right-4 top-[40px] z-20">
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
              className="hover:bg-surface-container-lowest/70"
            />
          )}
        />
      </div>
    </article>
  );
}

/** Ô viền đứt "+ Thư mục mới" ở đầu lưới thư mục — cao bằng cả thẻ thư mục (tính cả tab), không chỉ phần thân. */
export function NewFolderTile({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="h-full">
      <button
        type="button"
        onClick={onCreate}
        className="w-full h-full min-h-[158px] rounded-card border-2 border-dashed border-outline flex flex-col items-center justify-center gap-1.5 text-[12.5px] font-semibold text-on-surface-muted hover:border-outline-purple hover:text-primary hover:bg-surface-container-lowest transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon name="plus" size={18} />
        Thư mục mới
      </button>
    </div>
  );
}
