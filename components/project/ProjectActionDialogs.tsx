"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import { deleteProject, renameProject } from "@/lib/api/projects";
import type { Project } from "@/types/project";

export type ProjectAction = "rename" | "archive" | "delete";

export interface ProjectActionTarget {
  action: ProjectAction;
  project: Project;
}

interface ProjectActionDialogsProps {
  target: ProjectActionTarget | null;
  onClose: () => void;
  /** Gọi sau khi BE xác nhận — trang tải lại danh sách. */
  onDone: () => void | Promise<void>;
}

const CONFIRM: Record<Exclude<ProjectAction, "rename">, { title: string; icon: IconName; question: string; detail: string; cta: string; busy: string; failed: string }> = {
  archive: {
    title: "Lưu trữ dự án",
    icon: "archive",
    question: "Lưu trữ",
    detail: "Dự án sẽ bị ẩn khỏi danh sách đang làm; xem lại bằng bộ lọc Trạng thái: Lưu trữ.",
    cta: "Lưu trữ",
    busy: "Đang lưu trữ…",
    failed: "Không thể lưu trữ dự án",
  },
  delete: {
    title: "Xoá vĩnh viễn dự án",
    icon: "trash",
    question: "Xoá vĩnh viễn",
    detail: "Toàn bộ hội thoại, tài liệu SRS và dữ liệu đính kèm sẽ bị xoá hoàn toàn. Hành động này không thể hoàn tác.",
    cta: "Xoá vĩnh viễn",
    busy: "Đang xoá…",
    failed: "Không thể xoá vĩnh viễn dự án",
  },
};

/** 3 dialog thao tác trên card: đổi tên, lưu trữ, xoá vĩnh viễn. */
export default function ProjectActionDialogs({ target, onClose, onDone }: ProjectActionDialogsProps) {
  // `key` theo dự án + thao tác ⇒ mỗi lần mở là form mới (tên điền sẵn, không còn lỗi cũ)
  if (!target) return null;
  return <ActionDialog key={`${target.action}:${target.project._id}`} target={target} onClose={onClose} onDone={onDone} />;
}

function ActionDialog({ target, onClose, onDone }: ProjectActionDialogsProps & { target: ProjectActionTarget }) {
  const { action, project } = target;
  const [name, setName] = useState(project.name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (!submitting) onClose();
  };

  const run = async (call: () => Promise<unknown>, failed: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await call();
      await onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : failed);
    } finally {
      setSubmitting(false);
    }
  };

  const errorBox = error && (
    <p role="alert" className="text-[12.5px] text-on-error-container bg-error-container border border-error-border rounded-control px-3 py-2">
      {error}
    </p>
  );

  if (action === "rename") {
    return (
      <Modal open onClose={close} title="Đổi tên dự án">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void run(() => renameProject(project._id, name.trim()), "Không thể đổi tên dự án");
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rename-project" className="text-[12.5px] font-bold text-on-surface-medium">
              Tên dự án mới
            </label>
            <input
              id="rename-project"
              autoFocus
              type="text"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              className="h-10 px-3.5 rounded-control border border-outline bg-surface-container-low text-[13.5px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          {errorBox}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={submitting}>
              Huỷ
            </Button>
            <Button type="submit" loading={submitting} disabled={!name.trim() || name.trim() === project.name}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>
    );
  }

  const copy = CONFIRM[action];
  return (
    <Modal open onClose={close} title={copy.title}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 bg-error-container border border-error-border rounded-control p-4 text-on-error-container">
          <Icon name={copy.icon} size={20} className="mt-0.5" />
          <div>
            <p className="text-[13.5px] font-bold text-on-surface">
              {copy.question} &ldquo;{project.name}&rdquo;?
            </p>
            <p className="text-[12.5px] mt-1 leading-[1.55]">{copy.detail}</p>
          </div>
        </div>
        {errorBox}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Huỷ
          </Button>
          <Button
            variant="danger"
            loading={submitting}
            onClick={() => void run(() => deleteProject(project._id, { hard: action === "delete" }), copy.failed)}
          >
            {submitting ? copy.busy : copy.cta}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
