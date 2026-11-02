"use client";

import { useId, useRef, useState, type ReactElement } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

/**
 * Thanh công cụ ô chat hẹp hơn ngưỡng này ⇒ mọi chip (mức duyệt AI, Sửa tài liệu, Hỏi kiến thức BA) chỉ còn icon,
 * tên chip chuyển vào tooltip. Một ngưỡng chung cho cả ba: co lệch nhau thì chip còn nhãn đè lên nút gửi.
 * Đo ở `@container` của thanh công cụ trong `ChatInput`; ~540px là bề ngang cả ba nhãn (vi/en) + đính kèm + gửi.
 */
export const CHIP_LABEL_CLASS = "@max-[540px]:hidden";
export const CHIP_ICON_ONLY_CLASS = "@max-[540px]:w-8 @max-[540px]:justify-center @max-[540px]:px-0";

interface ChatToolbarTipProps {
  /** Nút chip; nhận `aria-describedby` trỏ tới câu gợi ý. Nhãn chữ của chip đánh dấu `data-chip-label`. */
  children: (describedBy: string | undefined) => ReactElement;
  /** Tên chip — hiện trong tooltip khi nhãn của chip đang bị ẩn (thanh hẹp, hoặc chip luôn chỉ có icon). */
  label: string;
  /** Câu giải thích (gợi ý, lý do khoá…). */
  hint?: string | null;
  /** Không hiện tooltip (vd. menu của chip đang mở). */
  disabled?: boolean;
  /** Nút đang ẩn ⇒ ẩn luôn khung bọc, không để lại khoảng trống trong thanh công cụ. */
  hidden?: boolean;
}

/**
 * Tooltip nền tối phía trên chip, hiện khi hover/focus. Vẽ qua portal ra `body` vì khung chat cắt phần tràn
 * (`overflow`) — tooltip nằm trong khung thì bị che dù z-index cao bao nhiêu. Thay cho `title` của trình duyệt.
 */
export default function ChatToolbarTip({ children, label, hint, disabled = false, hidden = false }: ChatToolbarTipProps) {
  const hintId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [labelHidden, setLabelHidden] = useState(false);

  // Nhãn bị ẩn bằng container query nên chỉ biết được lúc mở: đo ngay khi tooltip sắp hiện
  const onOpenChange = (open: boolean) => {
    if (!open) return;
    const el = triggerRef.current?.querySelector<HTMLElement>("[data-chip-label]");
    setLabelHidden(!el || getComputedStyle(el).display === "none");
  };

  // Không có gợi ý mà nhãn đang hiện ⇒ tooltip chẳng có gì mới để nói
  const empty = !hint && !labelHidden;

  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root onOpenChange={onOpenChange} open={disabled || hidden ? false : undefined}>
        {/* Bọc bằng span: nút bị khoá không nhận sự kiện chuột, span thì vẫn nhận ⇒ lý do khoá vẫn hiện được */}
        <TooltipPrimitive.Trigger asChild>
          <span ref={triggerRef} hidden={hidden} className="inline-flex shrink-0 rounded-control">
            {children(hint ? hintId : undefined)}
            {hint && (
              <span id={hintId} className="sr-only">
                {hint}
              </span>
            )}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          {!empty && (
            <TooltipPrimitive.Content
              side="top"
              align="start"
              sideOffset={8}
              collisionPadding={8}
              className="z-50 flex max-w-[240px] flex-col gap-0.5 rounded-inner bg-inverse-surface px-2.5 py-1.5 text-caption text-inverse-on-surface animate-in fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
            >
              {labelHidden && <span className="font-bold">{label}</span>}
              {hint && <span>{hint}</span>}
            </TooltipPrimitive.Content>
          )}
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
