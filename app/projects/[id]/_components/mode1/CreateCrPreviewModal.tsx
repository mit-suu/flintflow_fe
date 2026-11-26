"use client";

import { useTranslations } from "next-intl";
import type { PreviewResult } from "@/types/pipeline";
import type { Spine } from "@/types/spine";
import DiffPreviewModal from "../DiffPreviewModal";
import { titleFromInstruction, type ChatCrDraft } from "./prefill";

interface CreateCrPreviewModalProps {
  preview: PreviewResult;
  /** Câu lệnh của bản xem trước — thành tiêu đề + mô tả CR. */
  instruction: string;
  /** Đổi mã tham chiếu trong diff thành tên (FLF-297). */
  spine?: Spine | null;
  onCancel: () => void;
  /**
   * FLF-480 (B12): bấm "Tạo CR" ⇒ page đưa câu lệnh + `preview_id` vào khung chat đang mở (như `readChatCrDraft` +
   * `startEditing`), không `router.push` về chính trang đang mở nữa (trang không mount lại nên không chạy gì).
   */
  onCreate: (draft: ChatCrDraft) => void;
}

/**
 * Mode 1 v3 (bám BPMN 3.1): diff của panel "Sửa tài liệu có xem trước" với nút **Tạo CR** — điền sẵn lệnh +
 * `preview_id` vào khung chat của màn tài liệu đang mở (nguồn gợi ý: yêu cầu miệng; nguồn và người yêu cầu do BA
 * xác nhận). CR đi đủ 3.2 → 3.14, bản xem trước chỉ là gợi ý cho AI.
 */
export default function CreateCrPreviewModal({ preview, instruction, spine, onCancel, onCreate }: CreateCrPreviewModalProps) {
  const t = useTranslations("mode1.crPreviewModal");
  // Bản xem trước lỗi (AI dựng op sai đường dẫn, vi phạm luật…) không chặn 3.1: vẫn tạo CR từ câu lệnh, chỉ không kèm
  // bản xem trước — CR vẫn đi đủ 3.2 → 3.6 để AI tự làm rõ, tìm vị trí và đề xuất (gặp khi chạy e2e thật 2026-09-22)
  const usable = preview.ok && preview.violations.length === 0 && Boolean(preview.preview_id);
  const create = () => {
    const title = titleFromInstruction(instruction);
    const text = [title, instruction].filter((x) => x && x.trim()).filter((x, i, all) => all.indexOf(x) === i).join("\n");
    onCreate({ text, source: "verbal", preview_id: usable ? preview.preview_id : undefined });
  };
  return (
    <DiffPreviewModal
      preview={preview}
      spine={spine}
      onCancel={onCancel}
      onConfirm={create}
      confirmWhenInvalid
      confirmLabel={usable ? t("create") : t("createNoPreview")}
      note={usable ? t("note") : t("noteInvalid")}
    />
  );
}
