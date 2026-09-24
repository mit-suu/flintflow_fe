"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "@/lib/hooks/use-dialog-focus";
import IconButton from "./IconButton";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** `lg` cho dialog chứa lưới thẻ (chọn source mode); `xl` cho màn làm việc trong popup (gap report, change request mode 1). */
  size?: "md" | "lg" | "xl";
}

export default function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  const t = useTranslations("app.common");
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  // Portal ra body: tổ tiên có transform/translate (drawer sidebar) sẽ giam `position: fixed` trong nó
  return createPortal(
    <div
      className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-surface-container-lowest rounded-dialog p-6 sm:p-7 w-full max-h-[calc(100vh-32px)] overflow-y-auto shadow-[0_30px_80px_rgba(25,24,23,0.3)] ${
          size === "xl" ? "max-w-[1080px]" : size === "lg" ? "max-w-[760px]" : "max-w-[480px]"
        } outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 id={titleId} className="font-extrabold text-on-surface text-[17px]">
            {title}
          </h2>
          <IconButton icon="close" label={t("close")} onClick={onClose} />
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
