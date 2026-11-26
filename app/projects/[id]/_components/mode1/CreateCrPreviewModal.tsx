"use client";

import { useTranslations } from "next-intl";
import type { PreviewResult } from "@/types/pipeline";
import type { Spine } from "@/types/spine";
import DiffPreviewModal from "../DiffPreviewModal";

interface CreateCrPreviewModalProps {
  preview: PreviewResult;
  /** Đổi mã tham chiếu trong diff thành tên (FLF-297). */
  spine?: Spine | null;
  onCancel: () => void;
  /**
   * Tạo change request từ bản xem trước — cùng đường với nút "Tạo change request" trên thẻ chat (mở bước chọn nguồn +
   * người yêu cầu ngay trong chat). `previewId = null`: bản xem trước lỗi, CR đi từ câu lệnh.
   */
  onCreate: (previewId: string | null) => void;
}

/**
 * Mode 1 v3 (bám BPMN 3.1): diff đầy đủ của bản xem trước với nút **Tạo CR**. CR đi đủ 3.2 → 3.14, bản xem trước chỉ là
 * gợi ý cho AI. Trước đây nút này điền lại câu lệnh vào ô chat (không tạo CR, không đóng hộp) ⇒ gửi lại ra bản xem trước
 * mới, người dùng bị hỏi xác nhận mãi.
 */
export default function CreateCrPreviewModal({ preview, spine, onCancel, onCreate }: CreateCrPreviewModalProps) {
  const t = useTranslations("mode1.crPreviewModal");
  // Bản xem trước lỗi (AI dựng op sai đường dẫn, vi phạm luật…) không chặn 3.1: vẫn tạo CR từ câu lệnh, chỉ không kèm
  // bản xem trước — CR vẫn đi đủ 3.2 → 3.6 để AI tự làm rõ, tìm vị trí và đề xuất (gặp khi chạy e2e thật 2026-09-22)
  const usable = preview.ok && preview.violations.length === 0 && Boolean(preview.preview_id);
  return (
    <DiffPreviewModal
      preview={preview}
      spine={spine}
      onCancel={onCancel}
      onConfirm={() => onCreate(usable ? (preview.preview_id ?? null) : null)}
      confirmWhenInvalid
      confirmLabel={usable ? t("create") : t("createNoPreview")}
      note={usable ? t("note") : t("noteInvalid")}
    />
  );
}
