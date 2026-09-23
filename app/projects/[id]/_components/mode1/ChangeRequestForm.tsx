"use client";

import { useState, type FormEvent } from "react";
import { createCr } from "@/lib/api/change-requests";
import type { CrDetail, NEW_CR_SOURCE_KINDS } from "@/types/change-request";
import { errorText } from "./errors";
import { CR_SOURCE_KINDS, CR_SOURCE_LABELS } from "./labels";
import type { CrPrefill } from "./prefill";

interface ChangeRequestFormProps {
  projectId: string;
  prefill?: CrPrefill | null;
  onCreated: (detail: CrDetail) => void;
  onCancel: () => void;
}

type SourceKind = (typeof NEW_CR_SOURCE_KINDS)[number];

const inputClass =
  "w-full px-3 py-2 rounded-[10px] border-[1.5px] border-[#E4E1DC] focus:border-[#6A62C4] outline-none text-[13px] text-[#191817] bg-[#FAF9F7]";

/**
 * 3.1 Log change request (UC-48). Nguồn và người yêu cầu **bắt buộc** — mỗi thay đổi sau baseline phải truy
 * được về ai yêu cầu, từ đâu (BE trả `400 CR_SOURCE_REQUIRED` nếu thiếu; FE chặn trước để khỏi tốn một lượt).
 * Mode 1 v3: mở từ panel "Sửa tài liệu có xem trước" thì kèm `preview_id` — bản xem trước là gợi ý cho AI (3.2–3.6),
 * CR vẫn đi đủ các bước.
 */
export default function ChangeRequestForm({ projectId, prefill, onCreated, onCancel }: ChangeRequestFormProps) {
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [source, setSource] = useState<SourceKind | "">(prefill?.source ?? "");
  const [ref, setRef] = useState(prefill?.ref ?? "");
  const [note, setNote] = useState("");
  const [requester, setRequester] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return setError("Cần tiêu đề và mô tả thay đổi.");
    if (!source) return setError("Chọn nguồn của yêu cầu thay đổi.");
    if (!requester.trim()) return setError("Nhập người yêu cầu thay đổi.");
    setSubmitting(true);
    setError(null);
    try {
      const res = await createCr(projectId, {
        title: title.trim(),
        description: description.trim(),
        source: { kind: source, ref: ref.trim() || null, note: note.trim() || null },
        requester: requester.trim(),
        ...(prefill?.preview_id ? { preview_id: prefill.preview_id } : {}),
      });
      if (res.data) onCreated(res.data);
    } catch (err) {
      setError(errorText(err, "Không tạo được change request"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="bg-white border border-[#ECEAE5] rounded-[16px] p-5 flex flex-col gap-3" aria-label="Tạo change request">
      <h3 className="font-extrabold text-[#191817] text-[15px]">Tạo change request</h3>
      <label className="flex flex-col gap-1 text-[12.5px] font-bold text-[#4B4842]">
        Tiêu đề
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Ví dụ: Đăng xuất mọi thiết bị" />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px] font-bold text-[#4B4842]">
        Mô tả thay đổi
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputClass} placeholder="Cần đổi gì, vì sao…" />
      </label>
      {prefill?.preview_id && (
        <p className="text-[12px] text-[#554DB0] bg-[#F2F1FB] border border-[#DCD8F0] rounded-[10px] px-3 py-2" aria-label="Bản xem trước đính kèm">
          Đính kèm bản xem trước từ panel “Sửa tài liệu có xem trước” — AI dùng làm gợi ý khi làm rõ, tìm vị trí và đề xuất. Tài
          liệu chỉ đổi sau khi CR được duyệt.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-[12.5px] font-bold text-[#4B4842]">
          Nguồn *
          <select value={source} onChange={(e) => setSource(e.target.value as SourceKind | "")} className={inputClass}>
            <option value="">— Chọn nguồn —</option>
            {CR_SOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {CR_SOURCE_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-bold text-[#4B4842]">
          Người yêu cầu *
          <input value={requester} onChange={(e) => setRequester(e.target.value)} className={inputClass} placeholder="Ví dụ: PM Lan" />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-bold text-[#4B4842]">
          Tham chiếu nguồn
          <input value={ref} onChange={(e) => setRef(e.target.value)} className={inputClass} placeholder="Ví dụ: Email PM 17/09, biên bản họp số 3" />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-bold text-[#4B4842]">
          Ghi chú
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-[12.5px] text-[#B03030]">
          {error}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-[8px] border-[1.5px] border-[#E4E1DC] bg-white text-[13px] font-semibold text-[#4B4842]">
          Huỷ
        </button>
        <button type="submit" disabled={submitting} className="px-4 py-2 rounded-[8px] btn-gradient-primary text-white text-[13px] font-bold disabled:opacity-50 cursor-pointer">
          {submitting ? "Đang tạo…" : "Tạo change request"}
        </button>
      </div>
    </form>
  );
}
