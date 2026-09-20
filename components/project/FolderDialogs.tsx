"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import { createFolder, deleteFolder, updateFolder } from "@/lib/api/folders";
import { moveProjectToFolder } from "@/lib/api/projects";
import type { Folder, FolderColor } from "@/types/folder";
import type { Project } from "@/types/project";
import { FOLDER_COLORS, FOLDER_COLOR_ORDER, pickableFolderColor } from "./FolderCard";

export type FolderDialogTarget =
  | { kind: "create" }
  | { kind: "rename"; folder: Folder }
  | { kind: "delete"; folder: Folder }
  | { kind: "move"; project: Project };

interface FolderDialogsProps {
  target: FolderDialogTarget | null;
  folders: readonly Folder[];
  onClose: () => void;
  /** Gọi sau khi BE xác nhận — trang tải lại dự án + thư mục. */
  onDone: () => void | Promise<void>;
}

const FOLDER_NAME_MAX = 60; // khớp BE

/** Dialog thư mục: tạo, đổi tên/màu, xoá, chuyển dự án vào thư mục. */
export default function FolderDialogs({ target, folders, onClose, onDone }: FolderDialogsProps) {
  if (!target) return null;
  // `key` ⇒ mỗi lần mở là form mới
  const key = target.kind === "create" ? "create" : target.kind === "move" ? `move:${target.project._id}` : `${target.kind}:${target.folder._id}`;
  return <FolderDialog key={key} target={target} folders={folders} onClose={onClose} onDone={onDone} />;
}

function useSubmit(onDone: FolderDialogsProps["onDone"], onClose: () => void) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  return { submitting, error, run };
}

const ErrorBox = ({ error }: { error: string | null }) =>
  error ? (
    <p role="alert" className="text-[12.5px] text-on-error-container bg-error-container border border-error-border rounded-control px-3 py-2">
      {error}
    </p>
  ) : null;

function FolderDialog({ target, folders, onClose, onDone }: FolderDialogsProps & { target: FolderDialogTarget }) {
  const { submitting, error, run } = useSubmit(onDone, onClose);
  const close = () => {
    if (!submitting) onClose();
  };
  const initial = target.kind === "rename" ? target.folder : null;
  const [name, setName] = useState(initial?.name ?? "");
  // Thư mục mới mặc định xanh dương (tím dành cho card dự án); thư mục `violet` cũ mở ra là xanh dương
  const [color, setColor] = useState<FolderColor>(pickableFolderColor(initial?.color ?? "blue"));
  const [folderId, setFolderId] = useState<string | null>(target.kind === "move" ? target.project.folderId ?? null : null);

  if (target.kind === "delete") {
    return (
      <Modal open onClose={close} title="Xoá thư mục">
        <div className="flex flex-col gap-4">
          <p className="text-[13.5px] text-on-surface-medium leading-[1.6]">
            Xoá thư mục &ldquo;{target.folder.name}&rdquo;? Mọi dự án bên trong (kể cả dự án lưu trữ) vẫn được giữ và chuyển ra
            ngoài thư mục.
          </p>
          <ErrorBox error={error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={submitting}>
              Huỷ
            </Button>
            <Button variant="danger" loading={submitting} onClick={() => void run(() => deleteFolder(target.folder._id), "Không thể xoá thư mục")}>
              Xoá thư mục
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  if (target.kind === "move") {
    const options = [{ _id: null as string | null, name: "Không thuộc thư mục" }, ...folders.map((f) => ({ _id: f._id as string | null, name: f.name }))];
    return (
      <Modal open onClose={close} title="Chuyển vào thư mục">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => moveProjectToFolder(target.project._id, folderId), "Không thể chuyển dự án");
          }}
          className="flex flex-col gap-4"
        >
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[12.5px] text-on-surface-muted mb-2">
              Dự án &ldquo;{target.project.name}&rdquo;
            </legend>
            {options.map((o) => (
              <label
                key={o._id ?? "none"}
                className={`flex items-center gap-2.5 px-3 h-10 rounded-control border cursor-pointer text-[13px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
                  folderId === o._id ? "border-outline-purple bg-primary-soft text-primary-hover font-semibold" : "border-outline-variant hover:bg-surface-container-low"
                }`}
              >
                <input type="radio" name="move-folder" className="sr-only" checked={folderId === o._id} onChange={() => setFolderId(o._id)} />
                <Icon name={o._id ? "folder" : "layers"} size={16} />
                {o.name}
              </label>
            ))}
            {folders.length === 0 && <p className="text-[12px] text-on-surface-muted">Chưa có thư mục nào — tạo ở hàng Thư mục trên dashboard.</p>}
          </fieldset>
          <ErrorBox error={error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={submitting}>
              Huỷ
            </Button>
            <Button type="submit" loading={submitting} disabled={folderId === (target.project.folderId ?? null)}>
              Chuyển
            </Button>
          </div>
        </form>
      </Modal>
    );
  }

  const isCreate = target.kind === "create";
  const unchanged = !isCreate && name.trim() === target.folder.name && color === pickableFolderColor(target.folder.color);
  return (
    <Modal open onClose={close} title={isCreate ? "Thư mục mới" : "Sửa thư mục"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          void (isCreate
            ? run(() => createFolder({ name: trimmed, color }), "Không thể tạo thư mục")
            : run(() => updateFolder(target.folder._id, { name: trimmed, color }), "Không thể sửa thư mục"));
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="folder-name" className="text-[12.5px] font-bold text-on-surface-medium">
            Tên thư mục
          </label>
          <input
            id="folder-name"
            autoFocus
            type="text"
            value={name}
            maxLength={FOLDER_NAME_MAX}
            placeholder="Ví dụ: Khách hàng A"
            onChange={(e) => setName(e.target.value)}
            className="h-10 px-3.5 rounded-control border border-outline bg-surface-container-low text-[13.5px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <fieldset>
          <legend className="text-[12.5px] font-bold text-on-surface-medium mb-2">Màu</legend>
          <div className="flex gap-2.5">
            {FOLDER_COLOR_ORDER.map((c) => (
              <label key={c} title={FOLDER_COLORS[c].label} className="cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary rounded-full">
                <input type="radio" name="folder-color" className="sr-only" checked={color === c} onChange={() => setColor(c)} aria-label={FOLDER_COLORS[c].label} />
                <span
                  aria-hidden
                  className={`block w-7 h-7 rounded-full ${FOLDER_COLORS[c].swatch} ${color === c ? "ring-2 ring-offset-2 ring-on-surface" : ""}`}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Huỷ
          </Button>
          <Button type="submit" loading={submitting} disabled={!name.trim() || unchanged}>
            {isCreate ? "Tạo thư mục" : "Lưu"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
