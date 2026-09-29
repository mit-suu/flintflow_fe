"use client";

import { useRef, useState } from "react";
import { CR_MATERIAL_ACCEPT, type CrMaterialKind } from "@/types/change-request";

/** Một tài liệu bổ sung để hiện — tài liệu trên máy chủ (`CrMaterial`) hoặc tài liệu đang chờ gửi trong form 3.1. */
export interface MaterialItem {
  key: string;
  name: string;
  kind: CrMaterialKind;
  /** Chữ đã tách (máy chủ) / chữ đã dán; file chưa gửi ⇒ không có. */
  text?: string;
  truncated?: boolean;
  /** 0 = đính kèm lúc tạo, n = khi trả lời vòng n. Không có ⇒ chưa gửi. */
  round?: number;
}

const KIND_LABEL: Record<CrMaterialKind, string> = { text: "Văn bản dán", file: "File", image: "Ảnh" };
const PREVIEW_CHARS = 180;

/** Danh sách tài liệu bổ sung (phase 7): tên, loại, lúc đính kèm, đoạn đầu nội dung; xoá được khi còn sửa được. */
export function MaterialList({ items, onRemove, busy = false }: { items: MaterialItem[]; onRemove?: (key: string) => void; busy?: boolean }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Tài liệu bổ sung">
      {items.map((m) => (
        <li key={m.key} className="bg-white border border-[#ECEAE5] rounded-[10px] px-3 py-2 text-[12px] flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded-full bg-[#F2F1FB] text-[#554DB0] text-[10.5px] font-bold">{KIND_LABEL[m.kind]}</span>
            <span className="flex-1 font-semibold text-[#191817] truncate" title={m.name}>
              {m.name}
            </span>
            {m.round !== undefined && <span className="text-[11px] text-[#8A867E]">{m.round === 0 ? "lúc tạo CR" : `khi trả lời vòng ${m.round}`}</span>}
            {onRemove && (
              <button type="button" disabled={busy} onClick={() => onRemove(m.key)} className="text-[#B03030] font-bold hover:opacity-75 disabled:opacity-50" aria-label={`Xoá tài liệu ${m.name}`}>
                ✕
              </button>
            )}
          </div>
          {m.text && (
            <p className="text-[#6B6862] whitespace-pre-wrap break-words">
              {m.text.length > PREVIEW_CHARS ? `${m.text.slice(0, PREVIEW_CHARS)}…` : m.text}
            </p>
          )}
          {m.truncated && <p className="text-[11px] text-[#8A6D1F]">Tài liệu dài — AI chỉ đọc phần đầu (20 000 ký tự).</p>}
        </li>
      ))}
    </ul>
  );
}

interface MaterialAdderProps {
  /** Trả `false` (hoặc Promise `false`) khi không thêm được ⇒ giữ nội dung đang dán. */
  onAddText: (name: string, text: string) => unknown;
  onAddFile: (file: File) => unknown;
  busy?: boolean;
  /** Đã đủ số tài liệu tối đa. */
  full?: boolean;
}

/**
 * Thêm tài liệu bổ sung (phase 7): dán văn bản nguồn (email, biên bản…) hoặc chọn file .docx/.pdf/.txt/.md/ảnh.
 * AI đọc tài liệu này để lấy dữ kiện khi làm rõ và khi viết nội dung.
 */
export function MaterialAdder({ onAddText, onAddFile, busy = false, full = false }: MaterialAdderProps) {
  const [pasting, setPasting] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  if (full) return <p className="text-[11.5px] text-[#8A867E]">Đã đủ số tài liệu tối đa — xoá bớt để thêm tài liệu khác.</p>;

  return (
    <div className="flex flex-col gap-2">
      {pasting && (
        <div className="flex flex-col gap-1.5 bg-white border border-[#ECEAE5] rounded-[10px] p-2.5">
          <input
            aria-label="Tên tài liệu"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên, ví dụ: Email PM 23/09"
            className="w-full px-2.5 py-1.5 rounded-[8px] border border-[#E4E1DC] bg-[#FAF9F7] text-[12.5px]"
          />
          <textarea
            aria-label="Nội dung tài liệu"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Dán nội dung email, biên bản họp, đặc tả…"
            className="w-full px-2.5 py-1.5 rounded-[8px] border border-[#E4E1DC] bg-[#FAF9F7] text-[12.5px]"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setPasting(false)} className="px-3 py-1 rounded-[8px] border border-[#E4E1DC] bg-white text-[12px] font-semibold">
              Huỷ
            </button>
            <button
              type="button"
              disabled={busy || !name.trim() || !text.trim()}
              onClick={async () => {
                // Gửi lỗi (hook trả `false`) ⇒ giữ nội dung để người dùng sửa / thử lại
                if ((await onAddText(name.trim(), text.trim())) === false) return;
                setName("");
                setText("");
                setPasting(false);
              }}
              className="px-3 py-1 rounded-[8px] bg-[#191817] text-white text-[12px] font-bold disabled:opacity-50"
            >
              Thêm văn bản
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!pasting && (
          <button type="button" disabled={busy} onClick={() => setPasting(true)} className="px-3 py-1 rounded-[8px] border border-[#DCD8F0] bg-white text-[12px] font-bold text-[#554DB0] disabled:opacity-50">
            + Dán văn bản
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="px-3 py-1 rounded-[8px] border border-[#DCD8F0] bg-white text-[12px] font-bold text-[#554DB0] disabled:opacity-50">
          {busy ? "Đang đọc tài liệu…" : "+ Đính kèm file"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={CR_MATERIAL_ACCEPT}
          aria-label="Chọn file tài liệu bổ sung"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onAddFile(file);
          }}
        />
        <span className="self-center text-[11px] text-[#8A867E]">.docx, .pdf, .txt, .md hoặc ảnh (ảnh tốn 1 credit để AI đọc)</span>
      </div>
    </div>
  );
}

/** Giả định AI đã tự đặt khi viết đề xuất (phase 7) — người duyệt cần xác nhận với người yêu cầu. */
export function AssumptionsNote({ assumptions }: { assumptions: string[] | undefined }) {
  if (!assumptions?.length) return null;
  return (
    <div className="bg-[#FBF4E4] border border-[#EFD9A6] rounded-[8px] px-2.5 py-1.5 text-[12px] text-[#8A6D1F]" aria-label="Giả định cần xác nhận">
      <p className="font-bold">⚠ Giả định cần xác nhận — tài liệu và câu trả lời chưa nói:</p>
      <ul className="list-disc pl-5">
        {assumptions.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </div>
  );
}
