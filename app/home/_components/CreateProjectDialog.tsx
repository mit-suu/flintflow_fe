"use client";

import { useState, type FormEvent } from "react";
import Modal from "@/components/Modal";
import { createProject } from "@/lib/api/projects";
import type { Project, ProjectMode } from "@/types/project";

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

const MODES: { id: ProjectMode; icon: string; title: string; description: string; available: boolean }[] = [
  {
    id: "fpt",
    icon: "forum",
    title: "Soạn SRS mới với AI",
    description: "Trò chuyện theo quy trình có hướng dẫn, AI soạn SRS theo template FPT.",
    available: true,
  },
  {
    id: "import",
    icon: "upload_file",
    title: "Upload SRS có sẵn rồi sửa",
    description: "Tải lên file .docx, nhận gap report, sửa qua change request có Track Changes.",
    available: true,
  },
  {
    id: "customer_template",
    icon: "description",
    title: "Theo template của khách hàng",
    description: "Dùng template riêng của khách hàng.",
    available: false,
  },
];

/** Tạo dự án kèm cách làm SRS (UC-13): mode 2 `fpt`, mode 1 `import`; template khách hàng chưa hỗ trợ. */
export default function CreateProjectDialog({ open, onClose, onCreated }: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<ProjectMode>("fpt");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (submitting) return;
    setName("");
    setMode("fpt");
    setError(null);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createProject(name.trim(), mode);
      if (res.data) {
        setName("");
        setMode("fpt");
        onCreated(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo dự án");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Tạo dự án mới">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="project-name" className="text-[12.5px] font-bold text-[#4B4842]">
            Tên dự án
          </label>
          <input
            id="project-name"
            autoFocus
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: App Đặt Xe Online, E-Learning Platform…"
            className="w-full px-3.5 py-2.5 rounded-[10px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none text-[13.5px] text-[#191817] bg-[#FAF9F7] transition-all"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-[12.5px] font-bold text-[#4B4842] mb-1.5">Cách làm SRS</legend>
          {MODES.map((m) => (
            <label
              key={m.id}
              className={`flex items-start gap-3 rounded-[12px] border-[1.5px] px-3.5 py-3 transition-colors ${
                !m.available
                  ? "border-[#ECEAE5] bg-[#FAF9F7] opacity-60 cursor-not-allowed"
                  : mode === m.id
                    ? "border-[#4F46E5] bg-[#F4F3FE] cursor-pointer"
                    : "border-[#E4E1DC] bg-white hover:border-[#C9C5BD] cursor-pointer"
              }`}
            >
              <input
                type="radio"
                name="project-mode"
                value={m.id}
                checked={mode === m.id}
                disabled={!m.available}
                onChange={() => setMode(m.id)}
                className="sr-only"
                aria-label={m.title}
              />
              <span className="material-symbols-outlined text-[22px] text-[#4F46E5] mt-0.5">{m.icon}</span>
              <span className="flex-1">
                <span className="flex items-center gap-2 font-bold text-[13px] text-[#191817]">
                  {m.title}
                  {!m.available && <span className="px-1.5 py-0.5 rounded bg-[#F0EEEA] text-[10.5px] font-bold text-[#8A867E]">Sắp có</span>}
                </span>
                <span className="block text-[12px] text-[#8A867E] leading-snug">{m.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {error && (
          <p role="alert" className="text-[12.5px] text-[#B03030]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="w-full mt-1 py-3 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {submitting ? "Đang tạo dự án…" : mode === "import" ? "Tạo dự án và tải SRS lên →" : "Tạo dự án →"}
        </button>
      </form>
    </Modal>
  );
}
