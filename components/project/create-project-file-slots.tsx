"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
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
  /** FLF-398: dấu nội dung (SHA-256) — chọn lại file trùng nội dung thì không thêm. */
  fingerprint?: string;
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
      // `stopPropagation`: ô Tài liệu tham khảo nhận thả file ở cả thẻ — không để thẻ nhận lại lượt thả này lần nữa
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        if (!disabled) take(e.dataTransfer.files);
      }}
      // Ô trắng nằm trong thẻ của slot: trống ⇒ khối giữa (icon + lời mời + định dạng); đã có file ⇒ một dòng "Thêm file".
      // `relative`: input `sr-only` (absolute) phải bám ô này; thiếu thì nó bám khung nhìn, thoát overflow của AppShell và kéo dài cả trang
      className={`group relative rounded-inner transition-[background-color,box-shadow] duration-200 ${
        compact ? "flex items-center gap-2.5 px-3 py-2" : "flex-1 min-h-[132px] flex flex-col items-center justify-center gap-2 px-4 py-5 text-center"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${
        over ? "bg-primary-fixed ring-2 ring-primary" : "bg-surface-container-lowest/80 hover:bg-surface-container-lowest"
      } has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40`}
      // Vòng focus chỉ khi đi bằng bàn phím: bấm chuột chọn file xong input vẫn giữ focus, `focus-within` để lại viền tím kẹt
    >
      <span
        className={`shrink-0 rounded-full flex items-center justify-center text-primary transition-transform duration-200 ${
          compact ? "w-7 h-7 bg-primary-soft" : "w-11 h-11 bg-primary-soft group-hover:-translate-y-0.5"
        } ${over ? "-translate-y-0.5" : ""}`}
      >
        <Icon name={compact ? "plus" : icon} size={compact ? 14 : 20} />
      </span>
      <span className={`min-w-0 flex flex-col ${compact ? "flex-1" : "items-center gap-0.5"}`}>
        <span className={`font-semibold text-on-surface ${compact ? "text-caption" : "text-body"}`}>{compact ? t("addMore") : t("drop")}</span>
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

/** Đầu thẻ của một ô file: icon + tên ô + một dòng nói ô này dùng làm gì. */
function SlotHeader({ id, icon, title, hint, tone }: { id: string; icon: IconName; title: string; hint: string; tone: "primary" | "neutral" }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`w-9 h-9 shrink-0 rounded-control flex items-center justify-center ${tone === "primary" ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-primary"}`}>
        <Icon name={icon} size={18} />
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <h3 id={id} className="text-heading font-bold text-on-surface">
          {title}
        </h3>
        <p className="text-caption leading-relaxed text-on-surface-variant">{hint}</p>
      </div>
    </div>
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
  /** Đang kiểm file: icon xoay thay cho cỡ file (không thêm dòng, danh sách dài không giãn ra). Chuỗi là tên cho trình đọc màn hình. */
  busyLabel?: string;
  children?: React.ReactNode;
}

/** Một file đã chọn: tên + cỡ, nút bỏ; phần gợi ý (nếu có) nằm ngay dưới. */
function FileChip({ file, icon, disabled, onRemove, removeLabel, extra, busyLabel, children }: FileChipProps) {
  return (
    // `relative`: giữ input "Đổi" (`sr-only`, absolute) trong dòng này, không để nó kéo dài trang
    <li className="relative flex flex-col gap-2 rounded-inner bg-surface-container-lowest px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon name={icon} size={16} className="shrink-0 text-on-surface-muted" />
        <span className="flex-1 min-w-0 truncate text-body font-semibold text-on-surface" title={file.name}>
          {file.name}
        </span>
        {busyLabel ? (
          <span role="status" aria-label={busyLabel} title={busyLabel} className="shrink-0 text-on-surface-muted">
            <Icon name="spinner" size={14} className="animate-spin" />
          </span>
        ) : (
          <span className="shrink-0 text-caption text-on-surface-muted tabular-nums">{formatSize(file.size)}</span>
        )}
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
    <section aria-labelledby={`${checkboxId}-title`} className="flex flex-col gap-3 rounded-card bg-primary-soft p-4">
      <SlotHeader id={`${checkboxId}-title`} icon="file" title={t("label")} hint={t("hint")} tone="primary" />

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
        <div className="flex items-center gap-2.5 rounded-inner bg-surface-container-lowest px-3 py-2.5">
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

      {/* Ẩn chứ không gỡ: gỡ ra thì bỏ mẫu (X) sẽ mount lại, nút phải chờ BE đếm số mẫu mới hiện — trễ hơn ô thả file */}
      {orgTemplatePicker && <div hidden={hasSource} className="empty:hidden">{orgTemplatePicker}</div>}

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
  onClear: () => void;
  error?: string | null;
}

const SUGGEST_ACTION =
  "whitespace-nowrap px-2 h-7 rounded-control text-caption font-bold hover:bg-surface-container-lowest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

/** Có còn nội dung bên dưới mép vùng cuộn không — để làm mờ mép dưới, báo người dùng danh sách còn tiếp. */
function useMoreBelow(el: HTMLElement | null) {
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (!el) return;
    const update = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [el]);
  return more;
}

/**
 * Ô Tài liệu tham khảo: nhiều file, không giới hạn số file (business-flow §3.6 giới hạn theo token ở BE, không theo số file).
 * Danh sách dài nằm trong vùng cuộn riêng (~5 dòng) để hộp Tạo dự án không phình ra; tóm tắt + "Thêm file" luôn ở trên;
 * thả file vào bất kỳ đâu trong thẻ. File trông như SRS ⇒ gợi ý ngay dưới chip, không chặn, và được đưa lên đầu danh sách.
 */
export function ReferenceSlot({ files, hasSrs, disabled, onAdd, onRemove, onKeep, onMoveToSrs, onClear, error }: ReferenceSlotProps) {
  const t = useTranslations("app.createProject.references");
  const titleId = useId();
  const [over, setOver] = useState(false);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const moreBelow = useMoreBelow(scrollEl);
  const hasFiles = files.length > 0;
  const needsDecision = (ref: ReferenceFile) => !ref.keep && ref.precheck?.looks_like_srs === true;
  // FLF-409: chỉ có nội dung yêu cầu (vd bảng Use Case) ⇒ nhắc một dòng khi ô SRS trống, không đưa lên đầu, không bắt quyết
  const maybeSrs = (ref: ReferenceFile) => !hasSrs && !ref.keep && !needsDecision(ref) && ref.precheck?.srs_suggestion === "possible";
  // Gợi ý "trông như SRS" là việc cần quyết trước khi bấm Bắt đầu ⇒ lên đầu, không bị cuộn khuất
  const ordered = [...files.filter(needsDecision), ...files.filter((ref) => !needsDecision(ref))];
  const totalBytes = files.reduce((sum, ref) => sum + ref.file.size, 0);

  return (
    <section
      aria-labelledby={titleId}
      // Đã có file thì cả thẻ nhận thả file (ô "Thêm file" chỉ còn một dòng, khó nhắm)
      onDragOver={(e) => {
        if (!hasFiles || disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles) return;
        e.preventDefault();
        setOver(false);
        if (!disabled && e.dataTransfer.files.length) onAdd(Array.from(e.dataTransfer.files));
      }}
      className={`flex flex-col gap-3 rounded-card bg-surface-container p-4 transition-shadow duration-200 ${over ? "ring-2 ring-primary" : ""}`}
    >
      <SlotHeader id={titleId} icon="attach" title={t("label")} hint={t("hint")} tone="neutral" />
      {hasFiles && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-caption font-semibold text-on-surface-variant tabular-nums">{t("summary", { count: files.length, size: formatSize(totalBytes) })}</span>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="shrink-0 px-2 h-7 rounded-control text-caption font-bold text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("clearAll")}
          </button>
        </div>
      )}
      <DropZone
        label={t("label")}
        hint={t("dropHint")}
        accept={REFERENCE_EXTENSIONS.join(",")}
        multiple
        icon="attach"
        compact={hasFiles}
        disabled={disabled}
        onFiles={onAdd}
      />
      {error && (
        <p role="alert" className="text-caption text-on-error-container">
          {error}
        </p>
      )}
      {hasFiles && (
        // Vùng cuộn riêng ~5 dòng; mép dưới mờ dần khi còn file phía dưới
        <div
          ref={setScrollEl}
          // `ff-scroll` giữ sẵn rãnh 12px (`scrollbar-gutter: stable`): lấn sang lề phải của thẻ đúng 12px để rãnh nằm trong
          // lề, dòng file vẫn rộng bằng dòng "Thêm file"
          className={`max-h-[248px] overflow-y-auto ff-scroll -mr-3 ${
            moreBelow ? "[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]" : ""
          }`}
        >
        <ul aria-label={t("listLabel")} className="flex flex-col gap-1.5">
          {ordered.map((ref) => {
            const suggest = needsDecision(ref);
            return (
              <FileChip
                key={ref.key}
                file={ref.file}
                icon="attach"
                disabled={disabled}
                onRemove={() => onRemove(ref.key)}
                removeLabel={t("remove", { name: ref.file.name })}
                busyLabel={ref.precheck === undefined && isDocx(ref.file) ? t("checking") : undefined}
              >
                {maybeSrs(ref) && (
                  <p className="flex flex-wrap items-center gap-x-1 px-1 text-caption leading-relaxed text-on-surface-muted">
                    <span>{t("suggest.maybeSrs")}</span>
                    <button type="button" onClick={() => onMoveToSrs(ref.key)} disabled={disabled} className={`${SUGGEST_ACTION} text-primary`}>
                      {t("suggest.moveToSrs")}
                    </button>
                  </p>
                )}
                {suggest && (
                  // Lời gợi ý một hàng, nút một hàng riêng thẳng lề chữ — ô hẹp thì nút không bị bẻ đôi chữ
                  <div role="status" className="flex flex-col gap-1.5 rounded-control bg-primary-soft px-3 py-2.5">
                    <span className="flex items-start gap-2">
                      <Icon name="info" size={14} className="shrink-0 mt-0.5 text-primary" />
                      <span className="text-caption leading-relaxed text-on-surface">{hasSrs ? t("suggest.otherVersion") : t("suggest.looksLikeSrs")}</span>
                    </span>
                    {/* Nút chữ cỡ caption như "Xoá hết" / "Đổi": hành động chính màu tím, phụ màu xám; lề trái thẳng chữ gợi ý */}
                    <span className="flex flex-wrap items-center gap-1 pl-[14px]">
                      <button
                        type="button"
                        onClick={() => (hasSrs ? onRemove(ref.key) : onMoveToSrs(ref.key))}
                        disabled={disabled}
                        className={`${SUGGEST_ACTION} text-primary`}
                      >
                        {hasSrs ? t("suggest.drop") : t("suggest.moveToSrs")}
                      </button>
                      <button type="button" onClick={() => onKeep(ref.key)} disabled={disabled} className={`${SUGGEST_ACTION} text-on-surface-muted hover:text-on-surface`}>
                        {t("suggest.keep")}
                      </button>
                    </span>
                  </div>
                )}
              </FileChip>
            );
          })}
        </ul>
        </div>
      )}
    </section>
  );
}
