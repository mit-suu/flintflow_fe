"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { saveBlob } from "@/lib/api/files";
import { downloadVersion, listVersions } from "@/lib/api/versions";
import { versionFileName, versionLineage, type DocVersion } from "@/types/doc-version";
import { useProjectDocuments } from "../hooks/useProjectDocuments";
import AnchoredPopover from "./AnchoredPopover";
import CreditGateCard, { type CreditGateRequest } from "./CreditGateCard";
import ReferenceDocumentsPanel from "./mode1/ReferenceDocumentsPanel";
import { useMode1Labels } from "./mode1/i18n";

/**
 * Kết quả một lượt "Thêm tài liệu": huỷ ở cổng credit, đang có lượt tải khác (ô chat) nên chưa tải, hoặc tải xong (kèm câu
 * báo tệp trùng, nếu có).
 */
export type AddDocumentsResult = { cancelled: true } | { busy: true } | { cancelled: false; duplicates: string[] };

interface ProjectDocumentsButtonProps {
  projectId: string;
  projectName?: string;
  /** Dự án nhập SRS: có file SRS gốc để tải và có "Rút yêu cầu" (luồng change request). */
  mode1: boolean;
  readOnly?: boolean;
  /** Đổi giá trị ⇒ tải lại danh sách (vd vừa đính kèm xong ở ô chat). */
  refreshToken?: number;
  /** Cổng credit đọc tài liệu (một lần cho cả lượt chọn) rồi tải lên — cùng đường với nút kẹp giấy của ô chat. */
  onAdd: (files: File[]) => Promise<AddDocumentsResult>;
  /** Duyệt danh sách rút xong (CR đã tạo). */
  onCrsCreated?: () => void;
  /**
   * Cổng credit đang chờ (cùng trạng thái với thẻ trong khung chat). Đang thêm tài liệu từ popup ⇒ hiện ngay trong popup: thẻ
   * trong chat nằm sau popup nên người dùng không thấy để bấm, popup kẹt "Đang tải lên…" (E2E 24/11 #1).
   */
  creditConfirm?: (CreditGateRequest & { onRun: () => void; onCancel: () => void }) | null;
}

/** Bản import có file gốc người dùng tải lên (`variant=original`); chỉ dự án nhập SRS. */
function useOriginalSrs(projectId: string, enabled: boolean, refreshToken: number) {
  const [versions, setVersions] = useState<DocVersion[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listVersions(projectId)
      .then((res) => !cancelled && setVersions(res.data ?? []))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId, enabled, refreshToken]);
  return { versions, original: enabled ? (versions.find((v) => v.has_original_file) ?? null) : null };
}

/**
 * Nút "Tài liệu (n)" ở đầu khung chat: mở danh sách tài liệu của cả dự án (file SRS gốc + tài liệu tham khảo), Rút yêu cầu,
 * Xoá, Thêm tài liệu. Giống nhau ở mọi chế độ; phần chỉ có ở dự án nhập SRS ẩn đi ở dự án AI soạn.
 */
export default function ProjectDocumentsButton({ projectId, projectName, mode1, readOnly = false, refreshToken = 0, onAdd, onCrsCreated, creditConfirm = null }: ProjectDocumentsButtonProps) {
  const t = useTranslations("workspace.projectDocuments");
  const tv = useTranslations("mode1.versions");
  const L = useMode1Labels();
  const { docs, error, reload, remove } = useProjectDocuments(projectId, refreshToken);
  const { versions, original } = useOriginalSrs(projectId, mode1, refreshToken);
  const [adding, setAdding] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const references = docs ?? [];
  const count = references.length + (original ? 1 : 0);

  const pickFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setAdding(true);
    setMessage(null);
    try {
      const result = await onAdd(files);
      if ("busy" in result) {
        setMessage({ text: t("busy"), error: false });
        return;
      }
      if (result.cancelled) return;
      if (result.duplicates.length) setMessage({ text: result.duplicates.join(" "), error: false });
      await reload();
    } catch (err) {
      setMessage({ text: L.errorText(err, t("addFailed")), error: true });
    } finally {
      setAdding(false);
    }
  };

  const downloadOriginal = async () => {
    if (!original) return;
    setDownloading(true);
    setMessage(null);
    try {
      const { blob, filename } = await downloadVersion(projectId, original.version, "original", "docx");
      saveBlob(blob, filename ?? versionFileName({ name: projectName ?? "SRS", ...versionLineage(versions, original.version), tracked: false, original: true, ext: "docx", language: null }));
    } catch (err) {
      setMessage({ text: L.errorText(err, tv("downloadFailed")), error: true });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnchoredPopover
      label={t("title")}
      align="right"
      widthClassName="w-[400px]"
      // Thẻ xác nhận credit / chọn bản mới hiện trong khung chat ⇒ bấm vào đó không được đóng popup đang tải
      keepOpen={adding}
      trigger={({ open, toggle, ...aria }) => (
        <button
          type="button"
          {...aria}
          onClick={toggle}
          title={t("hint")}
          // Nhãn chữ có thể bị ẩn khi khung chat hẹp ⇒ tên đọc luôn đầy đủ qua aria-label
          aria-label={count > 0 ? t("buttonAria", { count }) : t("button")}
          // Thanh tiêu đề chat không có nền ⇒ nút tự mang nền như nút lịch sử phiên
          className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-full text-caption font-bold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            open ? "bg-primary-fixed text-primary" : "bg-surface-container-high text-on-surface-medium hover:bg-surface-container-highest hover:text-on-surface"
          }`}
        >
          <Icon name="attach" size={13} />
          {/* Container "chathead" của ChatPane: khung chat hẹp ⇒ chỉ còn icon + số. Không có tài liệu ⇒ luôn giữ chữ (không có số
              để đứng một mình) */}
          <span className={count > 0 ? "hidden @[30rem]/chathead:inline" : undefined}>{t("button")}</span>
          {/* Số 0 trông như một lời báo ⇒ chỉ hiện khi có tài liệu */}
          {count > 0 && <span className="tabular-nums text-primary">{count}</span>}
        </button>
      )}
    >
      {() => (
        <div className="flex flex-col gap-3">
          <h3 className="text-body font-bold text-on-surface">{t("title")}</h3>
          {message && (
            <p role={message.error ? "alert" : "status"} className={`text-body ${message.error ? "text-error" : "text-on-surface-variant"}`}>
              {message.text}
            </p>
          )}
          {original && (
            <section className="flex flex-col gap-1">
              <h4 className="text-caption font-semibold text-on-surface-muted">{t("srsFile")}</h4>
              <div className="flex items-center gap-2 rounded-inner px-2 py-1.5 bg-surface-container-low text-body">
                <span className="font-bold text-on-surface truncate min-w-0">{t("srsOriginal", { version: original.version })}</span>
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => void downloadOriginal()}
                  title={tv("originalFileTitle")}
                  className="ml-auto shrink-0 px-2.5 py-1 rounded-full text-caption font-bold bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest cursor-pointer disabled:opacity-50"
                >
                  {downloading ? tv("downloading") : tv("downloadOriginalFile")}
                </button>
              </div>
            </section>
          )}
          <section className="flex flex-col gap-1">
            <h4 className="text-caption font-semibold text-on-surface-muted">{t("references", { count: references.length })}</h4>
            {error !== null && (
              <p role="alert" className="text-body text-error">
                {L.errorText(error, t("loadFailed"))}
              </p>
            )}
            {error !== null && docs === null ? null : docs === null ? (
              <p className="text-body text-on-surface-muted">{t("loading")}</p>
            ) : references.length === 0 ? (
              <p className="text-body text-on-surface-muted">{t("empty")}</p>
            ) : (
              <ReferenceDocumentsPanel projectId={projectId} docs={references} onRemove={remove} onCrsCreated={() => onCrsCreated?.()} readOnly={readOnly} canExtract={mode1} />
            )}
          </section>
          {!readOnly && (
            <>
              <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => void pickFiles(e)} aria-hidden tabIndex={-1} />
              {adding && creditConfirm && <CreditGateCard {...creditConfirm} />}
              <button
                type="button"
                disabled={adding}
                onClick={() => fileRef.current?.click()}
                className="self-start inline-flex items-center gap-1.5 px-2 py-1 rounded-control text-body font-bold text-primary hover:bg-primary-soft cursor-pointer disabled:opacity-50"
              >
                <Icon name="plus" size={14} />
                {adding ? t("adding") : t("add")}
              </button>
            </>
          )}
        </div>
      )}
    </AnchoredPopover>
  );
}
