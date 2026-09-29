"use client";

import { useState, type FormEvent } from "react";
import { addCrMaterialFile, createCr } from "@/lib/api/change-requests";
import { CR_MAX_MATERIALS, type CrDetail, type NEW_CR_SOURCE_KINDS } from "@/types/change-request";
import { MaterialAdder, MaterialList } from "./CrMaterials";
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

/** BE nhận tối đa 5 đoạn dán trong body tạo CR; file gửi sau khi tạo. */
const MAX_PASTED = 5;

const inputClass =
  "w-full px-3 py-2 rounded-[10px] border-[1.5px] border-[#E4E1DC] focus:border-[#6A62C4] outline-none text-[13px] text-[#191817] bg-[#FAF9F7]";

/**
 * 3.1 Log change request (UC-48). Nguồn và người yêu cầu **bắt buộc** — mỗi thay đổi sau baseline phải truy
 * được về ai yêu cầu, từ đâu (BE trả `400 CR_SOURCE_REQUIRED` nếu thiếu; FE chặn trước để khỏi tốn một lượt).
 * Mode 1 v3: mở từ panel "Sửa tài liệu có xem trước" thì kèm `preview_id` — bản xem trước là gợi ý cho AI (3.2–3.6),
 * CR vẫn đi đủ các bước.
 * Phase 7: đính kèm tài liệu bổ sung (dán văn bản / file) để AI có dữ kiện khi viết nội dung — đoạn dán đi cùng lệnh tạo,
 * file upload lần lượt ngay sau khi tạo; file lỗi không làm mất CR (báo lại, người dùng đính kèm lại trong CR).
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
  const [pasted, setPasted] = useState<{ name: string; text: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  /** CR đã tạo nhưng có file upload lỗi ⇒ giữ form để báo, người dùng tự mở CR. */
  const [created, setCreated] = useState<CrDetail | null>(null);
  const attached = pasted.length + files.length;

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
        ...(pasted.length ? { materials: pasted } : {}),
      });
      if (!res.data) return;
      let latest = res.data;
      const failed: string[] = [];
      for (const file of files) {
        try {
          const up = await addCrMaterialFile(projectId, latest.change_request.cr_id, file);
          if (up.data) latest = up.data;
        } catch (err) {
          failed.push(`${file.name}: ${errorText(err, "không đọc được")}`);
        }
      }
      if (failed.length) {
        setCreated(latest);
        setError(`Đã tạo ${latest.change_request.cr_id} nhưng chưa đính kèm được: ${failed.join("; ")}. Mở change request để đính kèm lại.`);
        return;
      }
      onCreated(latest);
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
      <section className="flex flex-col gap-2 bg-[#FAF9F7] border border-[#ECEAE5] rounded-[12px] p-3" aria-label="Tài liệu bổ sung">
        <p className="text-[12.5px] font-bold text-[#4B4842]">Tài liệu bổ sung (không bắt buộc)</p>
        <p className="text-[11.5px] text-[#6B6862]">
          Email, biên bản họp, đặc tả… có dữ kiện cho thay đổi (con số, luật, luồng, trường dữ liệu). AI viết theo tài liệu; thiếu
          dữ kiện thì AI sẽ hỏi thêm sau khi tạo.
        </p>
        <MaterialList
          items={[
            ...pasted.map((m, i) => ({ key: `p${i}`, name: m.name, kind: "text" as const, text: m.text })),
            ...files.map((f, i) => ({ key: `f${i}`, name: f.name, kind: f.type.startsWith("image/") ? ("image" as const) : ("file" as const) })),
          ]}
          onRemove={(key) =>
            key.startsWith("p") ? setPasted((prev) => prev.filter((_, i) => `p${i}` !== key)) : setFiles((prev) => prev.filter((_, i) => `f${i}` !== key))
          }
          busy={submitting}
        />
        <MaterialAdder
          full={attached >= CR_MAX_MATERIALS}
          busy={submitting}
          onAddText={(name, text) => {
            if (pasted.length >= MAX_PASTED) {
              setError(`Dán tối đa ${MAX_PASTED} đoạn văn bản khi tạo — đính kèm file, hoặc thêm sau trong change request.`);
              return false;
            }
            setPasted((prev) => [...prev, { name, text }]);
          }}
          onAddFile={(file) => setFiles((prev) => [...prev, file])}
        />
      </section>
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
        {created ? (
          <button type="button" onClick={() => onCreated(created)} className="px-4 py-2 rounded-[8px] btn-gradient-primary text-white text-[13px] font-bold cursor-pointer">
            Mở {created.change_request.cr_id}
          </button>
        ) : (
          <button type="submit" disabled={submitting} className="px-4 py-2 rounded-[8px] btn-gradient-primary text-white text-[13px] font-bold disabled:opacity-50 cursor-pointer">
            {submitting ? (files.length ? "Đang tạo và đính kèm…" : "Đang tạo…") : "Tạo change request"}
          </button>
        )}
      </div>
    </form>
  );
}
