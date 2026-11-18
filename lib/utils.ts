import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gộp class Tailwind: clsx nối điều kiện, twMerge bỏ class trùng nhóm (class sau thắng). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Dãy số trang cho thanh phân trang, chèn `"..."` khi quá dài.
 * ≤5 trang: hiện hết. Đầu dãy: `1 2 3 4 … n`. Giữa: `1 … k-1 k k+1 … n`. Cuối: `1 … n-3 n-2 n-1 n`.
 */
export function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  const maxVisiblePages = 5;
  const pages: (number | string)[] = [];

  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  pages.push(1);
  if (currentPage <= 3) {
    for (let i = 2; i <= 4; i++) pages.push(i);
    pages.push("...", totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push("...");
    for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push("...");
    for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
    pages.push("...", totalPages);
  }
  return pages;
}
