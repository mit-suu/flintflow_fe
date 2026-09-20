"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import SearchInput from "@/components/ui/SearchInput";
import { addProjectsToFolder } from "@/lib/api/folders";
import { getSourceModeOption } from "@/lib/project-source-mode";
import type { Folder } from "@/types/folder";
import type { Project } from "@/types/project";

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
}

/** "Thêm dự án có sẵn" trong một thư mục: chọn nhiều dự án đang ở ngoài và chuyển vào (một request). Tạo dự án mới đi lối "Dự án mới". */
export default function AddToFolderDialog({ folder, ...rest }: AddToFolderDialogProps) {
  if (!folder) return null;
  // key ⇒ mỗi lần mở là trạng thái mới
  return <Dialog key={folder._id} folder={folder} {...rest} />;
}

function Dialog({ folder, projects, folderIds, onClose, onAdded }: AddToFolderDialogProps & { folder: Folder }) {
  const t = useTranslations("app.addToFolder");
  const tc = useTranslations("app.common");
  const tMode = useTranslations("app.sourceMode");
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
      if (!res.data?.moved) throw new Error(t("noneMoved"));
      await onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={close} title={t("title", { folder: folder.name })} size="lg">
      <div className="flex flex-col gap-3">
      {candidates.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-on-surface-muted">
            {t("allInFolder")}
          </p>
        ) : (
          <>
            <SearchInput value={query} onChange={setQuery} label={t("searchLabel")} placeholder={t("searchPlaceholder")} />
            <fieldset className="flex flex-col gap-1 max-h-[320px] overflow-y-auto -mx-1 px-1">
              <legend className="sr-only">{t("legend")}</legend>
              {visible.map((p) => {
                const checked = selected.has(p._id);
                const mode = getSourceModeOption(p.mode);
                return (
                  <label
                    key={p._id}
                    className={`flex items-center gap-3 min-h-11 px-3 py-2 rounded-control border cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
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
                      <span className="block text-[13.5px] font-medium text-on-surface truncate">{p.name}</span>
                      <span className="block text-[11px] text-on-surface-muted">
                        {tMode(`${mode.key}.shortLabel`)}
                        {p.folderId && folderIds.has(p.folderId) ? t("inOtherFolder") : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
              {visible.length === 0 && <p className="py-6 text-center text-[12.5px] text-on-surface-muted">{t("noMatch", { query: query.trim() })}</p>}
            </fieldset>

            {error && (
              <p role="alert" className="text-[12.5px] text-on-error-container bg-error-container border border-error-border rounded-control px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <span className="mr-auto text-[12px] text-on-surface-muted" aria-live="polite">
                {selected.size >= MAX_PER_REQUEST
                  ? t("selectedMax", { count: selected.size, max: MAX_PER_REQUEST })
                  : t("selected", { count: selected.size })}
              </span>
              <Button variant="secondary" onClick={close} disabled={submitting}>
                {tc("cancel")}
              </Button>
              <Button onClick={() => void submit()} loading={submitting} disabled={selected.size === 0}>
                {t("add")}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
