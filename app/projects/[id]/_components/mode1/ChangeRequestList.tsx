"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { listCrs } from "@/lib/api/change-requests";
import { listFlags } from "@/lib/api/flags";
import type { Flag } from "@/types/spine";
import { CR_TERMINAL_STATUSES, type Cr } from "@/types/change-request";
import PageSkeleton from "@/components/ui/PageSkeleton";
import ChangeRequestForm from "./ChangeRequestForm";
import ReferenceDocumentsPanel from "./ReferenceDocumentsPanel";
import { useErrorText, useMode1Labels } from "./i18n";
import { crHref, crPrefillHref, type CrPrefill } from "./prefill";

interface ChangeRequestListProps {
  projectId: string;
  /** Điền sẵn từ gap report / re-upload / chat (`?new=1&…`) ⇒ mở form ngay. */
  prefill: CrPrefill | null;
  /** Viewer: chỉ xem danh sách, không có nút tạo CR. */
  readOnly?: boolean;
}

type Filter = "open" | "closed" | "all";

/** FLF-343: cờ vàng import đặt cho chỗ độ tin thấp tự nhận vào baseline 0.1 ("Cần xem"). */
export const NEEDS_REVIEW_RULE = "import_needs_review";

const shortText = (s: string, max = 70) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

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
  const [review, setReview] = useState<Flag[] | null>(null);
  const [reviewError, setReviewError] = useState(false);

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

  /**
   * Câu của một cờ Cần xem theo ngôn ngữ giao diện (câu BE chỉ tiếng Việt): đường dẫn field ⇒ nhãn phần tử — trường; block
   * heading / bảng ⇒ mục khớp chưa chắc.
   */
  const reviewText = (f: Flag): string =>
    f.target_id && /^(project\.|[a-z_]+\[)/.test(f.target_id)
      ? t("needsReview.field", { what: L.pathLabel(f.target_id) })
      : t("needsReview.mapping", { section: f.section_id ? L.sectionName(f.section_id) : "—" });

  // "Cần xem" (FLF-343): cờ do BE đặt lúc import — FE chỉ lọc theo luật, không tự suy ra
  useEffect(() => {
    let cancelled = false;
    listFlags(projectId)
      .then((res) => !cancelled && setReview((res.data ?? []).filter((f) => f.rule_id === NEEDS_REVIEW_RULE && !f.resolved_at && !f.waived_by_user)))
      .catch(() => !cancelled && setReviewError(true));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

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

      {/* FLF-343: chỗ độ tin thấp đã vào baseline 0.1 — xem lại, sai thì tạo CR */}
      {reviewError && (
        <p role="alert" className="text-body text-[#B03030]">
          {t("needsReview.loadFailed")}
        </p>
      )}
      {review && review.length > 0 && (
        <section aria-label={t("needsReview.title", { count: review.length })} className="flex flex-col gap-2 bg-[#FBF4E4] border border-[#EFD9A6] rounded-[14px] px-4 py-3">
          <h3 className="text-body font-extrabold text-[#8A6D1F]">{t("needsReview.title", { count: review.length })}</h3>
          <p className="text-caption text-[#8A6D1F]">{t("needsReview.intro")}</p>
          <ul className="flex flex-col gap-1.5">
            {review.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 bg-white border border-[#EFD9A6] rounded-[10px] px-2.5 py-1.5">
                <span className="flex-1 min-w-[200px] text-body text-[#33312D]">{reviewText(f)}</span>
                {f.section_id && <span className="text-caption text-[#8A867E]">{L.sectionName(f.section_id)}</span>}
                {!readOnly && (
                  <Link
                    // Không điền nguồn: cờ do import đặt không thuộc nguồn CR nào (gap report, email…) — người dùng tự chọn
                    href={crPrefillHref(projectId, {
                      title: t("needsReview.prefillTitle", { message: shortText(reviewText(f)) }),
                      description: [reviewText(f), f.target_id ?? ""].filter(Boolean).join("\n"),
                      ref: f.section_id ? L.sectionName(f.section_id) : undefined,
                    })}
                    scroll={false}
                    className="ml-auto text-caption font-bold text-[#6A62C4] hover:underline shrink-0"
                  >
                    {t("needsReview.createCr")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
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
