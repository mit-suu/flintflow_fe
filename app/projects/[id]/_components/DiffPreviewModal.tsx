"use client";

import type { PreviewResult } from "@/types/pipeline";

interface DiffPreviewModalProps {
  preview: PreviewResult;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Mode 1 v3: "Tạo CR" thay "Xác nhận" — bản xem trước dùng để soạn change request, không áp thẳng. */
  confirmLabel?: string;
  busyLabel?: string;
  /** Dòng giải thích ngay trên nút (vd "tài liệu chỉ đổi sau khi CR được duyệt"). */
  note?: string;
  /** Cho bấm xác nhận cả khi bản xem trước lỗi (mode 1 v3: vẫn tạo CR, chỉ không kèm bản xem trước). */
  confirmWhenInvalid?: boolean;
}

const short = (value: unknown): string => {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "object" && "_absent" in (value as Record<string, unknown>)) return "(xoá)";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
};

/** Bảng diff trước khi áp lệnh sửa (UC 6.8): path / before / value / section ảnh hưởng / diagram. */
export default function DiffPreviewModal({
  preview,
  busy = false,
  onCancel,
  onConfirm,
  confirmLabel = "Xác nhận",
  busyLabel = "Đang áp dụng…",
  note,
  confirmWhenInvalid = false,
}: DiffPreviewModalProps) {
  const hasViolations = preview.violations.length > 0;
  // BUG-27: "Không có thay đổi nào" mà vẫn có nút Xác nhận là mời user bấm vào chỗ không làm gì.
  // Ngoại lệ: lượt hoà giải trả `no_change` — ở đó xác nhận CÓ nghĩa ("nội dung vẫn đúng", gỡ cờ).
  // Luồng CR của mode 1 v3 (`confirmWhenInvalid`) thì "Tạo CR" vẫn có nghĩa kể cả khi bản xem trước rỗng:
  // CR dựng từ câu lệnh, bản xem trước chỉ là thứ kèm thêm.
  const empty = !confirmWhenInvalid && preview.changes.length === 0 && !preview.no_change;
  const canConfirm = (confirmWhenInvalid || (preview.ok && !hasViolations && Boolean(preview.preview_id))) && !empty && !busy;

  return (
    <div className="fixed inset-0 bg-black/35 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-[20px] p-6 w-[640px] max-w-full max-h-[85vh] overflow-y-auto shadow-[0_30px_80px_rgba(0,0,0,0.3)] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-extrabold text-[15px] text-[#191817]">Xem trước thay đổi</h3>
          <div className="flex items-center gap-2">
            {preview.branch && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F2F1FB] text-[#6A62C4]">{preview.branch}</span>
            )}
            <button type="button" onClick={onCancel} className="p-1.5 hover:bg-[#F5F3F0] rounded-full text-[#8A867E] cursor-pointer">
              ✕
            </button>
          </div>
        </div>

        {hasViolations && (
          <div className="bg-[#FDEDED] border border-[#F2CACA] rounded-[12px] p-3 flex flex-col gap-1.5">
            {preview.violations.map((v, i) => (
              <div key={i} className="text-[11.5px] text-[#8A4141]">
                <span className="font-bold">{v.rule}</span>: {v.message}
                {v.path && <span className="font-mono text-[10.5px]"> ({v.path})</span>}
              </div>
            ))}
          </div>
        )}

        {preview.changes.length === 0 ? (
          <div className="text-[11.5px] py-4 text-center flex flex-col gap-1">
            <span className="text-[#A8A49C] italic">Không có thay đổi nào.</span>
            {preview.no_change && (
              <span className="text-[#4B4842]">
                {preview.notes ?? "Nội dung của các mục này vẫn đúng — xác nhận để gỡ cờ “đã cũ”."}
              </span>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="border border-[#ECEAE5] bg-[#FAF9F7] px-2 py-1 text-left font-bold">Path</th>
                  <th className="border border-[#ECEAE5] bg-[#FAF9F7] px-2 py-1 text-left font-bold">Before</th>
                  <th className="border border-[#ECEAE5] bg-[#FAF9F7] px-2 py-1 text-left font-bold">Value</th>
                </tr>
              </thead>
              <tbody>
                {preview.changes.map((change, i) => (
                  <tr key={i}>
                    <td className="border border-[#ECEAE5] px-2 py-1 font-mono align-top">{change.path}</td>
                    <td className="border border-[#ECEAE5] px-2 py-1 align-top text-[#B03030]">{short(change.before)}</td>
                    <td className="border border-[#ECEAE5] px-2 py-1 align-top text-[#1F7A45]">{short(change.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {preview.impact && (
          <div className="bg-[#FAF9F7] border border-[#ECEAE5] rounded-[12px] p-3 flex flex-col gap-2 text-[11px] text-[#4B4842]">
            <div className="font-extrabold text-[10px] text-[#8A867E] tracking-wider uppercase">Phạm vi ảnh hưởng</div>
            {preview.impact.sections.length > 0 && (
              <div>
                Section:{" "}
                {preview.impact.sections.map((s) => (
                  <span key={s.id} className="font-mono mr-1.5">
                    {s.id}
                    <span className="text-[#A8A49C]">({s.relation})</span>
                  </span>
                ))}
              </div>
            )}
            {preview.impact.diagrams.length > 0 && (
              <div>Diagram render lại: {preview.impact.diagrams.join(", ")}</div>
            )}
            {preview.impact.referrers.length > 0 && (
              <div className="text-[#8A6D1F]">
                Đang bị tham chiếu bởi: {preview.impact.referrers.map((r) => `${r.path}→${r.id}`).join(", ")}
              </div>
            )}
          </div>
        )}

        {note && <p className="text-[11.5px] text-[#554DB0] bg-[#F2F1FB] rounded-[10px] px-3 py-2">{note}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border border-[#ECEAE5] text-[#4B4842] hover:bg-[#FAF9F7] cursor-pointer disabled:opacity-50"
          >
            Huỷ
          </button>
          {!empty && (
            <button
              type="button"
              disabled={!canConfirm}
              onClick={onConfirm}
              className="px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-[#191817] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? busyLabel : preview.no_change && !confirmWhenInvalid ? "Xác nhận không đổi" : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
