"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import SearchInput from "@/components/ui/SearchInput";
import Tabs from "@/components/ui/Tabs";
import { addProjectsToFolder } from "@/lib/api/folders";
import { getSourceModeOption } from "@/lib/project-source-mode";
import type { Folder } from "@/types/folder";
import type { Project } from "@/types/project";
import CreateProjectForm from "./CreateProjectForm";

type Mode = "existing" | "create";

/** Khớp giới hạn `AddProjectsSchema` ở BE (1..100 dự án/lần). */
const MAX_PER_REQUEST = 100;

interface AddToFolderDialogProps {
  folder: Folder | null;
  /** Mọi dự án của user; dialog tự lọc ra dự án chưa thuộc thư mục này. */
  projects: readonly Project[];
  /** Thư mục còn tồn tại — để không ghi "đang ở thư mục khác" cho dự án trỏ tới thư mục đã xoá. */
  folderIds: ReadonlySet<string>;
  onClose: () => void;
  /** Sau khi thêm dự án có sẵn — trang tải lại. */
  onAdded: () => void | Promise<void>;
  /** Sau khi tạo dự án mới trong thư mục — trang tải lại rồi mở dự án. */
  onCreated: (project: Project) => void | Promise<void>;
}

/** "Thêm dự án" trong một thư mục: chọn nhiều dự án có sẵn (một request) hoặc tạo mới thẳng trong thư mục. */
export default function AddToFolderDialog({ folder, ...rest }: AddToFolderDialogProps) {
  if (!folder) return null;
  // key ⇒ mỗi lần mở là trạng thái mới
  return <Dialog key={folder._id} folder={folder} {...rest} />;
}

function Dialog({ folder, projects, folderIds, onClose, onAdded, onCreated }: AddToFolderDialogProps & { folder: Folder }) {
  const [mode, setMode] = useState<Mode>("existing");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = projects.filter((p) => p.status === "active" && p.folderId !== folder._id);
  const q = query.trim().toLocaleLowerCase("vi");
  const visible = q ? candidates.filter((p) => p.name.toLocaleLowerCase("vi").includes(q)) : candidates;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PER_REQUEST) next.add(id);
      return next;
    });

  const close = () => {
    if (!submitting) onClose();
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await addProjectsToFolder(folder._id, [...selected]);
      if (!res.data?.moved) throw new Error("Không có dự án nào được chuyển — có thể dự án đã bị xoá hoặc chuyển nơi khác.");
      await onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể thêm dự án vào thư mục");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={close} title={`Thêm dự án vào “${folder.name}”`} size="lg">
      <div className="flex flex-col gap-4">
        <Tabs
          label="Cách thêm dự án"
          idBase="add-to-folder"
          value={mode}
          onChange={setMode}
          options={[
            { value: "existing", label: "Chọn dự án có sẵn", count: candidates.length },
            { value: "create", label: "Tạo mới" },
          ]}
          className="self-start"
        />

        <div role="tabpanel" id="add-to-folder-panel" aria-labelledby={`add-to-folder-tab-${mode}`} className="flex flex-col gap-3">
          {mode === "create" ? (
            <CreateProjectForm variant="dialog" folderId={folder._id} onCreated={onCreated} onCancel={close} />
          ) : candidates.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-on-surface-muted">
              Mọi dự án đang làm đã nằm trong thư mục này. Chuyển sang &ldquo;Tạo mới&rdquo; để thêm dự án.
            </p>
          ) : (
            <>
              <SearchInput value={query} onChange={setQuery} label="Tìm dự án để thêm" placeholder="Tìm dự án…" />
              <fieldset className="flex flex-col gap-1 max-h-[320px] overflow-y-auto -mx-1 px-1">
                <legend className="sr-only">Dự án có thể thêm</legend>
                {visible.map((p) => {
                  const checked = selected.has(p._id);
                  const mode = getSourceModeOption(p.sourceMode);
                  return (
                    <label
                      key={p._id}
                      className={`flex items-center gap-3 min-h-11 px-3 py-2 rounded-[12px] border cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
                        checked ? "border-outline-purple bg-primary-soft" : "border-outline-variant hover:bg-surface-container-low"
                      }`}
                    >
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(p._id)} />
                      <span
                        aria-hidden
                        className={`w-[18px] h-[18px] rounded-[6px] border-2 flex items-center justify-center shrink-0 ${
                          checked ? "bg-primary border-primary text-on-primary" : "border-outline"
                        }`}
                      >
                        {checked && <Icon name="check" size={11} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-mono text-[13.5px] text-on-surface truncate">{p.name}</span>
                        <span className="block text-[11px] text-on-surface-muted">
                          {mode.shortLabel}
                          {p.folderId && folderIds.has(p.folderId) ? " · đang ở thư mục khác" : ""}
                        </span>
                      </span>
                    </label>
                  );
                })}
                {visible.length === 0 && <p className="py-6 text-center text-[12.5px] text-on-surface-muted">Không có dự án khớp &ldquo;{query.trim()}&rdquo;.</p>}
              </fieldset>

              {error && (
                <p role="alert" className="text-[12.5px] text-on-error-container bg-error-container border border-error-border rounded-[10px] px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2">
                <span className="mr-auto text-[12px] text-on-surface-muted" aria-live="polite">
                  Đã chọn {selected.size}
                  {selected.size >= MAX_PER_REQUEST && ` (tối đa ${MAX_PER_REQUEST} mỗi lần)`}
                </span>
                <Button variant="secondary" onClick={close} disabled={submitting}>
                  Huỷ
                </Button>
                <Button onClick={() => void submit()} loading={submitting} disabled={selected.size === 0}>
                  Thêm vào thư mục
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
