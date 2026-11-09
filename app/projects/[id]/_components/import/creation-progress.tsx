"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import type { ProjectUploads, UploadItem, UploadStatus } from "@/lib/project-uploads";
import { logoutAndRedirect } from "@/lib/auth";
import WorkspaceHeader from "../WorkspaceHeader";
import { StructureReading } from "./structure-preview";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const formatSize = (bytes: number | null) => (bytes === null ? "" : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Dấu trạng thái một bước: vòng quay khi đang chạy, dấu tích "bật" khi xong, cảnh báo khi lỗi. */
function StepMark({ status }: { status: UploadStatus | "pending" }) {
  if (status === "done")
    return (
      <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
        <Icon name="check-circle" size={20} className="text-success" />
      </motion.span>
    );
  if (status === "failed") return <Icon name="warning" size={20} className="text-on-error-container" />;
  if (status === "uploading") return <Icon name="spinner" size={20} className="text-primary animate-spin" />;
  return <span className="w-2 h-2 rounded-full bg-on-surface-subtle" />;
}

/** Số giây đã chạy — để người dùng thấy file lớn vẫn đang đi, không treo. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{Math.max(0, Math.round((now - since) / 1000))}s</span>;
}

interface CreationProgressProps {
  uploads: ProjectUploads;
  onRetry: (key: string) => void;
  /** Tải SRS lỗi ⇒ chọn file khác ngay tại đây. */
  onPickAnother?: () => void;
}

/**
 * Các bước ngay sau khi bấm Tạo dự án (file tải nền, không bắt chờ trong hộp thoại): ✓ Tạo dự án → tải file SRS lên và đọc khung →
 * tài liệu tham khảo x/y. Mỗi bước xong thì tích; lỗi thì báo + thử lại. SRS xong ⇒ trang tự mở màn đọc khung.
 */
export default function CreationProgress({ uploads, onRetry, onPickAnother }: CreationProgressProps) {
  const t = useTranslations("workspace.import.creating");
  const srs = uploads.items.find((i) => i.kind === "srs") ?? null;
  const refs = uploads.items.filter((i) => i.kind === "reference");
  const refsDone = refs.filter((r) => r.status === "done").length;
  const refsStatus: UploadStatus | "pending" = !refs.length ? "pending" : refs.some((r) => r.status === "failed") ? "failed" : refsDone === refs.length ? "done" : "uploading";

  const rows: { key: string; status: UploadStatus | "pending"; title: string; detail?: React.ReactNode; files?: UploadItem[] }[] = [
    { key: "project", status: "done", title: t("project") },
    ...(srs
      ? [
          {
            key: "srs",
            status: srs.status,
            title: t("srs"),
            detail: (
              <>
                {srs.name}
                {srs.size !== null && <> · {formatSize(srs.size)}</>}
                {srs.status === "uploading" && (
                  <>
                    {" "}
                    · <Elapsed since={uploads.startedAt} />
                  </>
                )}
              </>
            ),
          },
        ]
      : []),
    ...(refs.length ? [{ key: "refs", status: refsStatus, title: t("references", { done: refsDone, total: refs.length }), files: refs }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-heading font-bold text-on-surface">{t("title")}</h2>
        <p className="text-body text-on-surface-variant">{t("hint")}</p>
      </header>
      <p className="sr-only" aria-live="polite">
        {rows.filter((r) => r.status === "done").map((r) => r.title).join(", ")}
      </p>
      <ol className="flex flex-col gap-1 rounded-card bg-surface-container p-2">
        {rows.map((row, i) => (
          <motion.li
            key={row.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08, ease: EASE_OUT }}
            className={`flex flex-col gap-2 rounded-control px-3 py-3 ${row.status === "uploading" ? "bg-surface-container-lowest" : ""}`}
          >
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 shrink-0 flex items-center justify-center">
                <StepMark status={row.status} />
              </span>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className={`text-body font-semibold ${row.status === "pending" ? "text-on-surface-muted" : "text-on-surface"}`}>{row.title}</span>
                {row.detail && <span className="text-caption text-on-surface-muted truncate">{row.detail}</span>}
              </span>
              {row.key === "srs" && srs?.status === "failed" && (
                <span className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" icon="refresh" onClick={() => onRetry(srs.key)}>
                    {t("retry")}
                  </Button>
                  {onPickAnother && (
                    <Button size="sm" variant="ghost" onClick={onPickAnother}>
                      {t("pickAnother")}
                    </Button>
                  )}
                </span>
              )}
            </div>
            {row.files && row.files.some((f) => f.status === "failed") && (
              <ul className="ml-9 flex flex-col gap-1">
                {row.files
                  .filter((f) => f.status === "failed")
                  .map((f) => (
                    <li key={f.key} className="flex items-center gap-2 text-caption text-on-error-container">
                      <span className="flex-1 min-w-0 truncate">{t("fileFailed", { name: f.name })}</span>
                      <Button size="sm" variant="ghost" icon="refresh" onClick={() => onRetry(f.key)}>
                        {t("retry")}
                      </Button>
                    </li>
                  ))}
              </ul>
            )}
          </motion.li>
        ))}
        {srs && (
          <li className="flex items-start gap-3 rounded-control px-3 py-3">
            <span className="w-6 h-6 shrink-0 flex items-center justify-center">
              <StepMark status="pending" />
            </span>
            <span className="text-body font-semibold text-on-surface-muted">{t("preview")}</span>
          </li>
        )}
      </ol>
    </div>
  );
}

/**
 * Khung khi trang dự án còn đang đọc project nhưng tab này đang tải file của dự án vừa tạo: SRS đang tải ⇒ hiện ngay màn đọc khung
 * (trang đang quét), cùng bố cục với màn sau đó; tải lỗi ⇒ các bước có Thử lại.
 */
export function CreationProgressShell({ uploads, onRetry }: { uploads: ProjectUploads; onRetry: (key: string) => void }) {
  const t = useTranslations("workspace.import");
  const srs = uploads.items.find((i) => i.kind === "srs");
  const reading = srs?.status === "uploading";
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-container-lowest">
      {/* Thanh trên thật ngay từ khung đầu (tên vừa nhập + "Đang đọc file") — không để trống chờ đọc project */}
      <WorkspaceHeader
        project={null}
        user={null}
        fallbackName={uploads.projectName}
        baselineStatus={reading ? { label: t("badge.reading"), tone: "info" } : null}
        onLogout={() => void logoutAndRedirect()}
      />
      <main className="flex-1 min-h-0 overflow-y-auto ff-scroll">
        <div className={`${reading ? "max-w-[1180px]" : "max-w-[760px]"} mx-auto w-full px-4 sm:px-6 py-8`}>
          {reading ? <StructureReading fileName={srs.name} /> : <CreationProgress uploads={uploads} onRetry={onRetry} />}
        </div>
      </main>
    </div>
  );
}
