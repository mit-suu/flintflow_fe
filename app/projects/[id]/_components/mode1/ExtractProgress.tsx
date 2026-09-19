"use client";

import { sectionLabel } from "@/lib/constants/fpt-sections";
import type { ExtractionSection, ImportedDocument } from "@/types/import";
import PausedBanner from "./PausedBanner";

interface ExtractProgressProps {
  doc: ImportedDocument;
  sections: ExtractionSection[];
  /** Job nền đang chạy (FE đang poll). */
  running: boolean;
  credits: number | null;
  onStart: () => void;
  onResume: () => void;
  busy?: boolean;
}

const STATUS_ICON: Record<ExtractionSection["status"], { icon: string; color: string; label: string }> = {
  pending: { icon: "schedule", color: "#A8A49C", label: "Chờ" },
  done: { icon: "check_circle", color: "#1F7A45", label: "Xong" },
  failed: { icon: "error", color: "#B03030", label: "Lỗi" },
};

/**
 * 1.8 Trích field (I-4) theo section — chạy nền, FE poll `GET /import`. Hiện tiến độ, credit còn lại và banner
 * paused (UC-61, UC-75). Số liệu do BE trả; FE chỉ đếm section theo trạng thái để vẽ thanh tiến độ.
 */
export default function ExtractProgress({ doc, sections, running, credits, onStart, onResume, busy = false }: ExtractProgressProps) {
  const done = sections.filter((s) => s.status === "done").length;
  const total = sections.length;
  const notStarted = !running && !doc.paused && doc.extract_cursor === null && done === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-[#191817] text-[15px]">Trích field theo section</h3>
          <p className="text-[12px] text-[#8A867E]">
            Bảng khớp đủ cột được trích tất định (không tốn credit); phần văn xuôi do AI trích, mỗi lượt giữ credit trước và quyết
            toán sau. Có thể rời trang — việc trích vẫn chạy trên máy chủ.
          </p>
        </div>
        <div className="px-3 py-1 rounded-full bg-[#F0EEEA] text-[12px] font-semibold text-[#191817]">
          Credit khả dụng: {credits ?? "…"}
        </div>
      </div>

      {doc.paused && <PausedBanner paused={doc.paused} onResume={onResume} busy={busy} what="Trích field" />}

      {notStarted ? (
        <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-[#4B4842]">
            Mapping đã chốt — {total > 0 ? `${total} section` : "các section"} sẵn sàng để trích.
          </p>
          <button
            type="button"
            onClick={onStart}
            disabled={busy}
            className="px-5 py-2.5 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold disabled:opacity-50 cursor-pointer"
          >
            {busy ? "Đang bắt đầu…" : "Bắt đầu trích (AI)"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[12px] font-semibold text-[#4B4842]">
            <span>
              {running && <span className="inline-block w-3 h-3 mr-1.5 align-middle rounded-full border-2 border-[#E4E1DC] border-t-[#4F46E5] ff-spinner" />}
              {running ? `Đang trích${doc.extract_cursor ? ` ${sectionLabel(doc.extract_cursor)}` : ""}…` : "Đã dừng"}
            </span>
            <span>
              {done}/{total} section
            </span>
          </div>
          <div className="h-2 rounded-full bg-[#ECEAE5] overflow-hidden" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
            <div className="h-full bg-[#4F46E5] transition-all" style={{ width: total ? `${(done / total) * 100}%` : "0%" }} />
          </div>
        </div>
      )}

      {total > 0 && (
        <ul className="bg-white border border-[#ECEAE5] rounded-[14px] divide-y divide-[#F0EEEA]">
          {sections.map((s) => {
            const st = STATUS_ICON[s.status];
            const current = running && s.section_id === doc.extract_cursor;
            return (
              <li key={s.section_id} className={`px-3 py-2 flex items-center gap-3 text-[12.5px] ${current ? "bg-[#F4F3FE]" : ""}`}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: st.color }} aria-label={st.label}>
                  {st.icon}
                </span>
                <span className="flex-1 font-semibold text-[#191817]">{sectionLabel(s.section_id)}</span>
                {s.status === "done" && (
                  <span className="text-[11.5px] text-[#8A867E]">
                    {s.fields_total} field{s.fields_needing_review > 0 && <strong className="text-[#8A6D1F]"> · {s.fields_needing_review} cần xem</strong>}
                  </span>
                )}
                {s.error && <span className="text-[11.5px] text-[#B03030]">{s.error}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
