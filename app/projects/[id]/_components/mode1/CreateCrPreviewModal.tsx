"use client";

import { useRouter } from "next/navigation";
import type { PreviewResult } from "@/types/pipeline";
import DiffPreviewModal from "../DiffPreviewModal";
import { crPrefillHref, titleFromInstruction } from "./prefill";

interface CreateCrPreviewModalProps {
  projectId: string;
  preview: PreviewResult;
  /** Câu lệnh của bản xem trước — thành tiêu đề + mô tả CR. */
  instruction: string;
  onCancel: () => void;
}

/**
 * Mode 1 v3 (bám BPMN 3.1): diff của panel "Sửa tài liệu có xem trước" với nút **Tạo CR** — mở form 3.1 điền sẵn lệnh +
 * `preview_id` (nguồn gợi ý: yêu cầu miệng; nguồn và người yêu cầu do BA xác nhận). CR đi đủ 3.2 → 3.14, bản xem trước
 * chỉ là gợi ý cho AI. Tách riêng để panel của mode 2 không phụ thuộc router.
 */
export default function CreateCrPreviewModal({ projectId, preview, instruction, onCancel }: CreateCrPreviewModalProps) {
  const router = useRouter();
  const create = () => {
    if (!preview.preview_id) return;
    router.push(crPrefillHref(projectId, { title: titleFromInstruction(instruction), description: instruction, source: "verbal", preview_id: preview.preview_id }));
  };
  return (
    <DiffPreviewModal
      preview={preview}
      onCancel={onCancel}
      onConfirm={create}
      confirmLabel="Tạo CR"
      note="Thay đổi này sẽ thành change request (điền nguồn và người yêu cầu ở bước sau). Tài liệu chỉ đổi khi CR được duyệt."
    />
  );
}
