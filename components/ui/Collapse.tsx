"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PRESENCE_MS, usePresence } from "@/lib/hooks/use-presence";

interface CollapseProps {
  open: boolean;
  /** `y`: mở/thu theo chiều cao (khối dưới header); `x`: theo chiều rộng (panel bên phải). */
  axis?: "x" | "y";
  children: ReactNode;
  className?: string;
}

/**
 * Mở/thu mượt một khối nằm trong luồng bố cục: kích thước chạy từ 0 tới cỡ thật của nội dung (lưới `0fr → 1fr`,
 * không đo chiều cao bằng JS), nội dung đồng thời trượt nhẹ + fade. Đóng xong mới gỡ khỏi DOM.
 * Chỉ cắt tràn (`overflow-hidden`) trong lúc chạy hiệu ứng — mở hẳn rồi thì menu thả xuống bên trong không bị cắt.
 * Tôn trọng `prefers-reduced-motion`: bỏ chuyển động, chỉ bật/tắt.
 */
export default function Collapse({ open, axis = "y", children, className }: CollapseProps) {
  const { mounted, shown } = usePresence(open);
  // Mở sẵn từ đầu ⇒ không có hiệu ứng, không cần cắt tràn
  const [settled, setSettled] = useState(shown);
  // Mỗi lần đổi hướng (mở ↔ đóng) là một lượt hiệu ứng mới ⇒ cắt tràn lại tới khi chạy xong
  const [lastShown, setLastShown] = useState(shown);
  if (lastShown !== shown) {
    setLastShown(shown);
    setSettled(false);
  }
  // Hẹn giờ thay cho transitionend: vẫn chạy khi reduced-motion tắt transition
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setSettled(true), PRESENCE_MS);
    return () => clearTimeout(timer);
  }, [shown]);
  if (!mounted) return null;

  const track =
    axis === "y"
      ? `transition-[grid-template-rows] ${shown ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`
      : `transition-[grid-template-columns] ${shown ? "grid-cols-[1fr]" : "grid-cols-[0fr]"}`;
  const offset = axis === "y" ? "-translate-y-1" : "translate-x-3";

  return (
    <div
      className={`grid shrink-0 duration-200 ease-out motion-reduce:transition-none ${track} ${className ?? ""}`}
    >
      <div
        className={`min-h-0 min-w-0 flex transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
          axis === "y" ? "flex-col" : ""
        } ${shown && settled ? "overflow-visible" : "overflow-hidden"} ${shown ? "opacity-100 translate-0" : `opacity-0 ${offset}`}`}
      >
        {children}
      </div>
    </div>
  );
}
