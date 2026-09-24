"use client";

import Icon from "@/components/ui/Icon";
import type { PreviewResult } from "@/types/pipeline";
import { describeChange } from "./describe-change";

/** Kết quả lần sửa vừa áp — chỉ lần mới nhất mới được hoàn tác (BE undo lô gần nhất của cả dự án). */
export interface AppliedEdit {
  instruction: string;
  count: number;
  version: number;
}

interface ChatEditCardProps {
  /** Lệnh sửa đang xử lý (hoặc vừa áp). */
  instruction: string;
  previewing: boolean;
  applying: boolean;
  clarification: string | null;
  error: string | null;
  /** Bản xem trước của lệnh sửa (không phải của lượt cập nhật mục cũ). */
  preview: PreviewResult | null;
  applied: AppliedEdit | null;
  /** Mode 1: áp thẳng không được — nút chính là "Tạo change request". */
  requiresCr?: boolean;
  onShowDetail: () => void;
  onApply: () => void;
  onCancel: () => void;
  onUndo: () => void;
  onDismiss: () => void;
}

const MAX_LINES = 3;

/**
 * Thẻ sửa tài liệu nằm trong dòng chat: đang xem trước → (hỏi lại / lỗi) → tóm tắt thay đổi → đã áp dụng.
 * Diff đầy đủ vẫn mở bằng "Xem chi tiết" (DiffPreviewModal); thẻ chỉ tóm tắt để quyết định nhanh.
 */
export default function ChatEditCard({
  instruction,
  previewing,
  applying,
  clarification,
  error,
  preview,
  applied,
  requiresCr = false,
  onShowDetail,
  onApply,
  onCancel,
  onUndo,
  onDismiss,
}: ChatEditCardProps) {
  const blocked = preview ? !preview.ok || preview.violations.length > 0 : false;
  const empty = preview ? preview.changes.length === 0 : false;

  return (
    <div role="status" aria-label="Sửa tài liệu" className="self-stretch rounded-card bg-surface-container-lowest p-3.5 flex flex-col gap-2.5">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="w-7 h-7 shrink-0 grid place-items-center rounded-inner bg-primary-soft text-primary">
          <Icon name="pencil" size={14} />
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[11px] font-bold text-on-surface-muted">Sửa tài liệu</span>
          <p className="text-[12.5px] text-on-surface leading-relaxed break-words">{applied?.instruction ?? instruction}</p>
        </div>
        {!previewing && !applying && (
          <button
            type="button"
            onClick={applied ? onDismiss : onCancel}
            aria-label="Đóng thẻ sửa"
            className="w-6 h-6 shrink-0 grid place-items-center rounded-inner text-on-surface-muted hover:bg-surface-container-high hover:text-on-surface cursor-pointer transition-colors"
          >
            <Icon name="close" size={13} />
          </button>
        )}
      </div>

      {previewing && (
        <p className="flex items-center gap-2 text-[12px] text-on-surface-muted">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent ff-spinner" aria-hidden />
          Đang tìm những chỗ cần sửa…
        </p>
      )}

      {clarification && (
        <div className="rounded-control bg-primary-soft px-3 py-2 text-[12px] text-primary-hover leading-relaxed">
          <span className="font-bold">Cần bạn nói rõ hơn: </span>
          {clarification}
          <span className="block mt-1 text-[11px] opacity-80">Gõ lại lệnh sửa ở ô chat bên dưới.</span>
        </div>
      )}

      {error && <p className="text-[12px] text-error">{error}</p>}

      {preview && !applied && (
        <>
          {blocked ? (
            <p className="text-[12px] text-error leading-relaxed">
              Không áp được lệnh này: {preview.violations[0]?.message ?? "tài liệu sẽ mâu thuẫn sau khi sửa."} Thử diễn đạt lại
              hoặc xem chi tiết.
            </p>
          ) : empty ? (
            <p className="text-[12px] text-on-surface-muted">Không tìm thấy chỗ nào cần đổi theo lệnh này.</p>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-on-surface">
                Sẽ thay đổi {preview.changes.length} chỗ
                {preview.impact && preview.impact.sections.length > 0 && ` · ảnh hưởng ${preview.impact.sections.length} mục`}
              </span>
              <ul className="flex flex-col gap-0.5">
                {preview.changes.slice(0, MAX_LINES).map((change, i) => (
                  <li key={i} className="text-[11.5px] text-on-surface-variant leading-relaxed break-words">
                    • {describeChange(change)}
                  </li>
                ))}
                {preview.changes.length > MAX_LINES && (
                  <li className="text-[11.5px] text-on-surface-muted">và {preview.changes.length - MAX_LINES} chỗ khác</li>
                )}
              </ul>
            </div>
          )}
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onCancel}
              className="h-8 px-3 rounded-control text-[12px] font-bold text-on-surface-variant hover:bg-surface-container-high cursor-pointer transition-colors"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={onShowDetail}
              className="h-8 px-3 rounded-control text-[12px] font-bold bg-surface-container text-on-surface hover:bg-surface-container-high cursor-pointer transition-colors"
            >
              Xem chi tiết
            </button>
            {(requiresCr || (!blocked && !empty)) && (
              <button
                type="button"
                onClick={onApply}
                disabled={applying}
                className="h-8 px-3 rounded-control text-[12px] font-bold bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                {requiresCr ? "Tạo change request" : applying ? "Đang áp dụng…" : "Áp dụng"}
              </button>
            )}
          </div>
        </>
      )}

      {applied && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-success">
            <Icon name="check-circle" size={15} />
            {applied.count > 0 ? `Đã áp dụng ${applied.count} thay đổi` : "Đã xác nhận, nội dung không đổi"}
          </span>
          {applied.count > 0 && (
            <button
              type="button"
              onClick={onUndo}
              disabled={applying}
              className="h-8 px-3 rounded-control text-[12px] font-bold bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-60 cursor-pointer transition-colors"
            >
              {applying ? "Đang hoàn tác…" : "Hoàn tác"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
