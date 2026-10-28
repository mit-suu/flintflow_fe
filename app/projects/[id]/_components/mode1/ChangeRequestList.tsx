"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { listCrs } from "@/lib/api/change-requests";
import { CR_TERMINAL_STATUSES, type Cr } from "@/types/change-request";
import PageSkeleton from "@/components/ui/PageSkeleton";
import ChangeRequestForm from "./ChangeRequestForm";
import ReferenceDocumentsPanel from "./ReferenceDocumentsPanel";
import { useErrorText, useMode1Labels } from "./i18n";
import { crHref, type CrPrefill } from "./prefill";

interface ChangeRequestListProps {
  projectId: string;
  /** Điền sẵn từ gap report / re-upload / chat (`?new=1&…`) ⇒ mở form ngay. */
  prefill: CrPrefill | null;
  /** Viewer: chỉ xem danh sách, không có nút tạo CR. */
  readOnly?: boolean;
}

type Filter = "open" | "closed" | "all";

export const statusTone = (status: Cr["status"]): string =>
  status === "written"
    ? "bg-[#E9F7EE] text-[#1F7A45]"
    : status === "rejected" || status === "cancelled"
      ? "bg-[#F0EEEA] text-[#8A867E]"
      : status === "manual_fix" || status === "awaiting_answers" || status === "in_review"
        ? "bg-[#FBF4E4] text-[#8A6D1F]"
        : "bg-[#F2F1FB] text-[#554DB0]";

/** Danh sách change request + tạo mới (UC-48). */
export default function ChangeRequestList({ projectId, prefill, readOnly = false }: ChangeRequestListProps) {
  const t = useTranslations("mode1.crList");
  const L = useMode1Labels();
  // Hàm ổn định (đọc nhãn qua ref) — đổi ngôn ngữ không tải lại danh sách
  const errorText = useErrorText();
  const router = useRouter();
  const [crs, setCrs] = useState<Cr[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(prefill !== null && !readOnly);
  const [filter, setFilter] = useState<Filter>("open");

  const load = useCallback(
    () =>
      listCrs(projectId)
        .then((res) => setCrs(res.data ?? []))
        .catch((err: unknown) => setError(errorText(err, "loadCrList"))),
    [projectId, errorText]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const shown = (crs ?? []).filter((c) =>
    filter === "all" ? true : filter === "open" ? !CR_TERMINAL_STATUSES.includes(c.status) : CR_TERMINAL_STATUSES.includes(c.status)
  );

  return (
    <div className="flex flex-col gap-4 max-w-[920px] w-full mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-title font-extrabold text-[#191817]">{t("title")}</h2>
          <p className="text-body text-[#8A867E]">{t("intro")}</p>
        </div>
        {!formOpen && !readOnly && (
          <button type="button" onClick={() => setFormOpen(true)} className="px-4 py-2 rounded-full btn-gradient-primary text-white text-body font-bold cursor-pointer">
            {t("create")}
          </button>
        )}
      </div>

      {formOpen && (
        <ChangeRequestForm
          projectId={projectId}
          prefill={prefill}
          onCancel={() => setFormOpen(false)}
          onCreated={(d) => router.push(crHref(projectId, d.change_request.cr_id), { scroll: false })}
        />
      )}

      {error && (
        <p role="alert" className="text-body text-[#B03030]">
          {error}
        </p>
      )}

      {/* FLF-338 §3.6.1: tài liệu tham khảo ⇒ rút yêu cầu ⇒ nhiều CR một lúc */}
      <ReferenceDocumentsPanel projectId={projectId} readOnly={readOnly} onCrsCreated={() => void load()} />

      <div className="flex gap-1.5" role="group" aria-label={t("filterAria")}>
        {(["open", "closed", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-body font-bold ${filter === f ? "bg-[#191817] text-white" : "bg-white border border-[#ECEAE5] text-[#6B6862]"}`}
          >
            {t(`filters.${f}`)}
          </button>
        ))}
      </div>

      {crs === null ? (
        <PageSkeleton variant="list" rows={3} label={t("loading")} />
      ) : shown.length === 0 ? (
        <p className="text-body text-[#8A867E] bg-white border border-[#ECEAE5] rounded-[14px] px-4 py-6 text-center">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((c) => (
            <li key={c.cr_id}>
              <Link
                href={crHref(projectId, c.cr_id)}
                scroll={false}
                className="bg-white border border-[#ECEAE5] rounded-[14px] px-4 py-3 flex flex-wrap items-center gap-3 hover:shadow-[0_8px_20px_rgba(25,24,23,0.06)] transition-shadow"
              >
                <code className="text-body font-bold text-[#6A62C4]">{c.cr_id}</code>
                <span className="flex-1 min-w-[200px] font-bold text-[#191817] text-body truncate">{c.title}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-caption font-bold ${statusTone(c.status)}`}>{L.crStatus(c.status)}</span>
                {c.paused && <span className="px-2 py-0.5 rounded-full text-caption font-bold bg-[#FDEDED] text-[#B03030]">{t("paused")}</span>}
                <span className="w-full text-body text-[#8A867E]">
                  {L.crSource(c.source.kind)}
                  {L.sourceRefLabel(c.source.ref) ? ` · ${L.sourceRefLabel(c.source.ref)}` : ""} · {c.requester} · {L.formatDateTime(c.created_at)}
                  {c.result_doc_version ? t("writtenTo", { version: c.result_doc_version }) : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
