import { useEffect, useState } from "react";

/** Thời lượng chuẩn của hiệu ứng mở/đóng (ms) — khớp `duration-200` trên phần tử. */
export const PRESENCE_MS = 200;

/**
 * Giữ phần tử trong DOM đủ lâu để chạy hiệu ứng đóng.
 * - `mounted`: có render hay không — bật ngay khi mở, tắt sau `ms` khi đóng.
 * - `shown`: trạng thái hiển thị để gắn class transition — bật một khung hình sau khi mount (để trình duyệt
 *   thấy trạng thái đầu rồi mới chuyển), tắt ngay khi đóng.
 */
export function usePresence(open: boolean, ms: number = PRESENCE_MS) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(open);
  // Mở lại ⇒ mount ngay trong lượt render này (mẫu "điều chỉnh state theo prop", không cần effect)
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setEntered(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    const timer = setTimeout(() => {
      setMounted(false);
      setEntered(false);
    }, ms);
    return () => clearTimeout(timer);
  }, [open, ms]);

  return { mounted, shown: open && entered };
}
