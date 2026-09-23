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
  // Bản xem trước lỗi (AI dựng op sai đường dẫn, vi phạm luật…) không chặn 3.1: vẫn tạo CR từ câu lệnh, chỉ không kèm
  // bản xem trước — CR vẫn đi đủ 3.2 → 3.6 để AI tự làm rõ, tìm vị trí và đề xuất (gặp khi chạy e2e thật 2026-09-22)
  const usable = preview.ok && preview.violations.length === 0 && Boolean(preview.preview_id);
  const create = () => {
    const base = { title: titleFromInstruction(instruction), description: instruction, source: "verbal" as const };
    router.push(crPrefillHref(projectId, usable ? { ...base, preview_id: preview.preview_id } : base));
  };
  return (
    <DiffPreviewModal
      preview={preview}
      onCancel={onCancel}
      onConfirm={create}
      confirmWhenInvalid
      confirmLabel={usable ? "Tạo CR" : "Tạo CR (không kèm bản xem trước)"}
      note={
        usable
          ? "Thay đổi này sẽ thành change request (điền nguồn và người yêu cầu ở bước sau). Tài liệu chỉ đổi khi CR được duyệt."
          : "Bản xem trước lỗi — vẫn tạo được change request từ câu lệnh; AI sẽ làm rõ, tìm vị trí và đề xuất trong CR."
      }
    />
  );
}
