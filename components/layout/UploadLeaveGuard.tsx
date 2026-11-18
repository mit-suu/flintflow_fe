"use client";

import { useLeaveGuard } from "@/lib/hooks/use-leave-guard";
import { useHasPendingUploads } from "@/lib/project-uploads";

/**
 * File của hộp Tạo dự án tải nền trong bộ nhớ của tab (`lib/project-uploads`): còn file đang tải / chờ chọn bản thì tải lại hay
 * đóng tab sẽ mất file đó ⇒ trình duyệt hỏi trước. Gắn ở layout gốc để chuyển trang trong app vẫn được che.
 */
export default function UploadLeaveGuard() {
  useLeaveGuard(useHasPendingUploads());
  return null;
}
