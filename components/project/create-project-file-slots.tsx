"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import type { DocxPrecheck } from "@/types/document";

/** Khớp giới hạn của BE: SRS như upload import (40 MB), tài liệu tham khảo như đính kèm chat (10 MB). */
export const SRS_MAX_BYTES = 40 * 1024 * 1024;
export const REFERENCE_MAX_BYTES = 10 * 1024 * 1024;
export const REFERENCE_EXTENSIONS = [".docx", ".pdf", ".doc", ".md", ".txt"] as const;

const extensionOf = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();
export const isDocx = (file: File) => extensionOf(file.name) === ".docx";
export const isReferenceType = (file: File) => (REFERENCE_EXTENSIONS as readonly string[]).includes(extensionOf(file.name));

export interface ReferenceFile {
  key: string;
  file: File;
  /** `undefined` = đang kiểm; `null` = không kiểm được / không phải .docx. */
  precheck?: DocxPrecheck | null;
  /** Người dùng đã chọn giữ làm tham khảo — không hiện gợi ý nữa. */
  keep?: boolean;
}

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

interface DropZoneProps {
  /** Nhãn của ô (đồng thời là tên truy cập của nút chọn file). */
  label: string;
  hint: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  icon: IconName;
  onFiles: (files: File[]) => void;
  /** Ô thu gọn: đã có file ⇒ chỉ còn một dòng "thêm file". */
  compact?: boolean;
}

/** Vùng thả file phẳng (không viền): kéo thả hoặc bấm để chọn; bàn phím vào được qua nút ẩn trong nhãn. */
function DropZone({ label, hint, accept, multiple = false, disabled = false, icon, onFiles, compact = false }: DropZoneProps) {
  const t = useTranslations("app.createProject.slots");
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const inputId = useId();

  const take = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <label
      htmlFor={inputId}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) take(e.dataTransfer.files);
      }}
      className={`flex items-center gap-3 rounded-card px-4 transition-colors ${compact ? "py-2.5" : "py-4"} ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${over ? "bg-primary-container" : "bg-surface-container hover:bg-surface-container-high"} focus-within:ring-2 focus-within:ring-primary/30`}
    >
      <span className="w-9 h-9 shrink-0 rounded-control flex items-center justify-center bg-surface-container-lowest text-primary">
        <Icon name={icon} size={18} />
      </span>
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-body font-bold text-on-surface">{compact ? t("addMore") : t("drop")}</span>
        {!compact && <span className="text-caption text-on-surface-muted">{hint}</span>}
      </span>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-label={label}
        className="sr-only"
        onChange={(e) => {
          take(e.target.files);
          // Chọn lại đúng file vừa bỏ vẫn phải bắn change
          e.target.value = "";
        }}
      />
    </label>
  );
}

interface FileChipProps {
  file: File;
  icon: IconName;
  disabled?: boolean;
  onRemove: () => void;
  removeLabel: string;
  /** Hành động phụ cạnh nút bỏ (vd "Đổi" file SRS). */
  extra?: React.ReactNode;
  children?: React.ReactNode;
}

/** Một file đã chọn: tên + cỡ, nút bỏ; phần gợi ý (nếu có) nằm ngay dưới. */
function FileChip({ file, icon, disabled, onRemove, removeLabel, extra, children }: FileChipProps) {
  return (
    <li className="flex flex-col gap-2 rounded-card bg-surface-container px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon name={icon} size={16} className="shrink-0 text-on-surface-muted" />
        <span className="flex-1 min-w-0 truncate text-body font-semibold text-on-surface" title={file.name}>
          {file.name}
        </span>
        <span className="shrink-0 text-caption text-on-surface-muted tabular-nums">{formatSize(file.size)}</span>
        {extra}
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={removeLabel}
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-muted hover:bg-surface-container-high hover:text-on-surface cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      {children}
    </li>
  );
}

interface SrsSlotProps {
  file: File | null;
  /** Mẫu đã lưu của tổ chức chọn thay cho file. */
  orgTemplateName: string | null;
  completeToStandard: boolean;
  disabled?: boolean;
  onFile: (file: File | null) => void;
  onClearOrgTemplate: () => void;
  onCompleteToStandardChange: (value: boolean) => void;
  /** Lối "Chọn từ mẫu của tổ chức" (chỉ hiện khi tổ chức có mẫu). */
  orgTemplatePicker?: React.ReactNode;
  error?: string | null;
}

/** Ô SRS: 0–1 file .docx (kể cả mẫu khách còn trống) + ô chọn "Bổ sung các mục còn thiếu theo mẫu chuẩn FlintFlow". */
export function SrsSlot({ file, orgTemplateName, completeToStandard, disabled, onFile, onClearOrgTemplate, onCompleteToStandardChange, orgTemplatePicker, error }: SrsSlotProps) {
  const t = useTranslations("app.createProject.srs");
  const tooltipId = useId();
  const checkboxId = useId();
  const changeRef = useRef<HTMLInputElement>(null);
  const hasSource = !!file || !!orgTemplateName;

  return (
    <section aria-labelledby={`${checkboxId}-title`} className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h3 id={`${checkboxId}-title`} className="text-body font-bold text-on-surface-medium">
          {t("label")}
        </h3>
        <p className="text-caption text-on-surface-muted">{t("hint")}</p>
      </div>

      {file ? (
        <ul>
          <FileChip
            file={file}
            icon="file"
            disabled={disabled}
            onRemove={() => onFile(null)}
            removeLabel={t("remove", { name: file.name })}
            extra={
              <>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => changeRef.current?.click()}
                  className="shrink-0 px-2 h-7 rounded-control text-caption font-bold text-primary hover:bg-surface-container-high cursor-pointer disabled:opacity-50"
                >
                  {t("change")}
                </button>
                <input
                  ref={changeRef}
                  type="file"
                  accept=".docx"
                  aria-label={t("change")}
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => {
                    const next = e.target.files?.[0];
                    if (next) onFile(next);
                    e.target.value = "";
                  }}
                />
              </>
            }
          />
        </ul>
      ) : orgTemplateName ? (
        <div className="flex items-center gap-2.5 rounded-card bg-surface-container px-3 py-2.5">
          <Icon name="file-template" size={16} className="shrink-0 text-primary" />
          <span className="flex-1 min-w-0 truncate text-body font-semibold text-on-surface">{t("orgTemplateChosen", { name: orgTemplateName })}</span>
          <button
            type="button"
            onClick={onClearOrgTemplate}
            disabled={disabled}
            aria-label={t("remove", { name: orgTemplateName })}
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-muted hover:bg-surface-container-high hover:text-on-surface cursor-pointer disabled:opacity-50"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ) : (
        <DropZone label={t("label")} hint={t("dropHint")} accept=".docx" icon="upload" disabled={disabled} onFiles={(files) => onFile(files[0] ?? null)} />
      )}
      {error && (
        <p role="alert" className="text-caption text-on-error-container">
          {error}
        </p>
      )}

      {!hasSource && orgTemplatePicker}

      {hasSource && (
        <div className="flex items-center gap-2 pt-1">
          <input
            id={checkboxId}
            type="checkbox"
            checked={completeToStandard}
            disabled={disabled}
            onChange={(e) => onCompleteToStandardChange(e.target.checked)}
            aria-describedby={tooltipId}
            className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
          />
          <label htmlFor={checkboxId} className="text-body text-on-surface cursor-pointer">
            {t("completeToStandard")}
          </label>
          {/* ⓘ: hover hoặc focus bằng bàn phím đều hiện giải thích; chữ cũng là mô tả của ô chọn cho trình đọc màn hình */}
          <span className="relative group inline-flex">
            <button type="button" aria-label={t("completeInfoLabel")} aria-describedby={tooltipId} className="w-6 h-6 rounded-full flex items-center justify-center text-on-surface-muted hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary/40 outline-none cursor-help">
              <Icon name="info" size={15} />
            </button>
            <span
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 w-[300px] -translate-x-1/2 rounded-control bg-inverse-surface px-3 py-2 text-caption leading-relaxed text-inverse-on-surface opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {t("completeInfo")}
            </span>
          </span>
        </div>
      )}
    </section>
  );
}

interface ReferenceSlotProps {
  files: ReferenceFile[];
  /** Ô SRS đang có file (đổi lời gợi ý cho file trông như SRS). */
  hasSrs: boolean;
  disabled?: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  onKeep: (key: string) => void;
  onMoveToSrs: (key: string) => void;
  error?: string | null;
}

/** Ô Tài liệu tham khảo: nhiều file; file trông như SRS ⇒ gợi ý ngay dưới chip, không chặn (business-flow §3.6). */
export function ReferenceSlot({ files, hasSrs, disabled, onAdd, onRemove, onKeep, onMoveToSrs, error }: ReferenceSlotProps) {
  const t = useTranslations("app.createProject.references");
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h3 id={titleId} className="text-body font-bold text-on-surface-medium">
          {t("label")}
        </h3>
        <p className="text-caption text-on-surface-muted">{t("hint")}</p>
      </div>
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((ref) => {
            const suggest = !ref.keep && ref.precheck?.looks_like_srs === true;
            return (
              <FileChip key={ref.key} file={ref.file} icon="attach" disabled={disabled} onRemove={() => onRemove(ref.key)} removeLabel={t("remove", { name: ref.file.name })}>
                {ref.precheck === undefined && isDocx(ref.file) && (
                  <p className="flex items-center gap-1.5 text-caption text-on-surface-muted" aria-live="polite">
                    <Icon name="spinner" size={12} className="animate-spin" />
                    {t("checking")}
                  </p>
                )}
                {suggest && (
                  <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-control bg-surface-container-lowest px-3 py-2">
                    <Icon name="sparkle" size={14} className="shrink-0 text-primary" />
                    <span className="flex-1 min-w-[180px] text-caption text-on-surface">{hasSrs ? t("suggest.otherVersion") : t("suggest.looksLikeSrs")}</span>
                    <span className="flex items-center gap-1">
                      {hasSrs ? (
                        <Button size="sm" variant="ghost" onClick={() => onRemove(ref.key)} disabled={disabled}>
                          {t("suggest.drop")}
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => onMoveToSrs(ref.key)} disabled={disabled}>
                          {t("suggest.moveToSrs")}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => onKeep(ref.key)} disabled={disabled}>
                        {t("suggest.keep")}
                      </Button>
                    </span>
                  </div>
                )}
              </FileChip>
            );
          })}
        </ul>
      )}
      <DropZone
        label={t("label")}
        hint={t("dropHint")}
        accept={REFERENCE_EXTENSIONS.join(",")}
        multiple
        icon="attach"
        compact={files.length > 0}
        disabled={disabled}
        onFiles={onAdd}
      />
      {error && (
        <p role="alert" className="text-caption text-on-error-container">
          {error}
        </p>
      )}
    </section>
  );
}
