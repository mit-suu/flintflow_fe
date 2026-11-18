/**
 * Link trông như nút: `Button` render `<button>` nên không dùng được cho điều hướng thật (`next/link`).
 * Cùng thang bo góc, cỡ chữ và màu với `Button` để hai thứ đứng cạnh nhau không lệch.
 */
export const LINK_PRIMARY =
  "inline-flex h-10 items-center justify-center rounded-control bg-primary px-5 text-body font-bold text-on-primary hover:bg-primary-hover transition-colors";

export const LINK_SECONDARY =
  "inline-flex h-8 items-center rounded-control bg-surface-container-high px-3.5 text-body font-bold text-on-surface-medium hover:bg-surface-container-highest transition-colors";
