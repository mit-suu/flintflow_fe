"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";

interface NoticeTrayProps {
  /** Đang có việc cần chỗ trong khung chat (CR đang mở, bản xem trước) ⇒ thu các thẻ nhắc về một dòng. */
  collapsed: boolean;
  children: ReactNode;
}

/**
 * Khay thẻ nhắc phía trên ô chat (lưu cấu trúc thành mẫu, cờ nên xem, mẫu có bản mới…). Footer của khung chat cao theo nội
 * dung và vùng tin nhắn co lại theo footer, nên các thẻ này xếp chồng từng ép thread change request còn một khe. Khay giới
 * hạn chiều cao (cuộn bên trong) và thu thành một dòng khi `collapsed`; bấm dòng đó để mở. Thẻ con tự quyết có hiện hay
 * không, nên khay đo chiều cao thật của chúng: không còn thẻ nào ⇒ không hiện dòng thu gọn.
 */
export default function NoticeTray({ collapsed, children }: NoticeTrayProps) {
  const t = useTranslations("workspace.noticeTray");
  const innerRef = useRef<HTMLDivElement>(null);
  // Chưa đo ⇒ coi như có thẻ; ResizeObserver đo lại ngay khi bắt đầu theo dõi (không có / bản giả của test ⇒ giữ nguyên)
  const [hasContent, setHasContent] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = innerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // ResizeObserver gọi lần đầu ngay khi bắt đầu theo dõi, rồi mỗi khi thẻ con hiện / ẩn
    const observer = new ResizeObserver(() => setHasContent(el.offsetHeight > 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const expanded = !collapsed || open;
  return (
    <>
      {collapsed && hasContent && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={expanded}
          className="mx-3 mb-2 h-8 px-3 inline-flex items-center gap-1.5 rounded-full bg-surface-container text-caption font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high cursor-pointer"
        >
          <Icon name="bell" size={14} />
          {expanded ? t("hide") : t("show")}
          <Icon name={expanded ? "chevron-down" : "chevron-up"} size={14} />
        </button>
      )}
      {/* Thu gọn: vẫn render (giữ state của thẻ, đo được chiều cao) nhưng không chiếm chỗ, không nhận focus */}
      <div className={expanded ? "max-h-[38vh] overflow-y-auto ff-scroll" : "h-0 overflow-hidden"} inert={!expanded} aria-hidden={!expanded || undefined}>
        <div ref={innerRef}>{children}</div>
      </div>
    </>
  );
}
