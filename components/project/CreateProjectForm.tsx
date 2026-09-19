"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { createProject } from "@/lib/api/projects";
import type { Project, ProjectMode } from "@/types/project";
import SourceModePicker from "./SourceModePicker";

export const DEFAULT_PROJECT_NAME = "Dự án chưa đặt tên";
const NAME_MAX = 100; // khớp CreateProjectSchema ở BE

interface CreateProjectFormProps {
  /** `inline`: nằm trên dashboard khi chưa có dự án; `dialog`: trong dialog "+ Dự án mới". */
  variant: "inline" | "dialog";
  onCreated: (project: Project) => void | Promise<void>;
  onCancel?: () => void;
  /** Đang ở trong một thư mục ⇒ dự án tạo thẳng trong đó. */
  folderId?: string;
}

/**
 * Tạo dự án theo source mode (UC-13/14) — một component cho cả empty state và dialog. Lỗi hiện ngay dưới
 * form và giữ nguyên lựa chọn để user thử lại.
 */
export default function CreateProjectForm({ variant, onCreated, onCancel, folderId }: CreateProjectFormProps) {
  const [mode, setMode] = useState<ProjectMode | null>(null);
  const [name, setName] = useState(DEFAULT_PROJECT_NAME);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `project-name-${variant}`;

  const canSubmit = mode !== null && name.trim().length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mode || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createProject(name.trim(), mode, folderId);
      if (!res.data) throw new Error("Không nhận được dự án vừa tạo");
      await onCreated(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo dự án");
      setSubmitting(false);
    }
    // Thành công: giữ trạng thái gửi cho tới khi chuyển trang, tránh bấm tạo hai lần
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <SourceModePicker value={mode} onChange={setMode} disabled={submitting} />

      <div className={`flex flex-col gap-3 ${variant === "inline" ? "sm:flex-row sm:items-end" : ""}`}>
        <div className="flex flex-col gap-1.5 flex-1">
          <label htmlFor={inputId} className="text-[12.5px] font-bold text-on-surface-medium">
            Tên dự án
          </label>
          <input
            id={inputId}
            type="text"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => {
              if (name === DEFAULT_PROJECT_NAME) e.target.select();
            }}
            className="h-10 px-3.5 rounded-[12px] border border-outline bg-surface-container-low text-[13.5px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className={`flex gap-2 ${variant === "dialog" ? "justify-end" : ""}`}>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={submitting}>
              Huỷ
            </Button>
          )}
          <Button type="submit" disabled={!canSubmit} loading={submitting} iconRight="arrow-right">
            {submitting ? "Đang tạo…" : "Bắt đầu"}
          </Button>
        </div>
      </div>

      {!mode && <p className="text-[12px] text-on-surface-muted -mt-2">Chọn một cách bắt đầu ở trên để tiếp tục.</p>}
      {error && (
        <p role="alert" className="text-[12.5px] text-on-error-container bg-error-container border border-error-border rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}
    </form>
  );
}
