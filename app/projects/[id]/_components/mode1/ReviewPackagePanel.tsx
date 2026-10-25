"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@/lib/api/client";
import { getSpine } from "@/lib/api/spine";
import { getReviewPackage, releaseDocument, requestPackageChanges, submitReviewPackage } from "@/lib/api/versions";
import type { ReviewPackage } from "@/types/doc-version";
import type { Flag } from "@/types/spine";
import type { OrgRole } from "@/types/organization";
import { useMode1Labels } from "./i18n";
import { crHref } from "./prefill";

interface ReviewPackagePanelProps {
  projectId: string;
  /** Vai trò trong org: Lead duyệt / yêu cầu sửa / phát hành; Analyst gửi duyệt; Viewer chỉ xem. */
  role: OrgRole | null;
  /** Sau khi gửi / yêu cầu sửa / phát hành: tải lại Spine, cờ, version. */
  onChanged: () => void;
}

const REASON_MIN = 10;

/**
 * Gói duyệt (FLF-330, business-flow §3.2 C-7 — CR kiểu GitHub): bản nháp chung = baseline gốc + mọi CR BA đã xác nhận;
 * BA **gửi Lead duyệt cả gói** (cờ đỏ = 0) ⇒ bản nháp khoá; Lead **duyệt cả gói** (= phát hành số chính) hoặc **yêu cầu
 * sửa** kèm lý do ⇒ mở khoá. Lead tự làm thì phát hành thẳng từ đây. Không duyệt từng CR.
 */
export default function ReviewPackagePanel({ projectId, role, onChanged }: ReviewPackagePanelProps) {
  const t = useTranslations("mode1.reviewPackage");
  const L = useMode1Labels();
  const [pkg, setPkg] = useState<ReviewPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"submit" | "changes" | "release" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockingFlags, setBlockingFlags] = useState<Flag[]>([]);
  const [asking, setAsking] = useState<"changes" | "release" | null>(null);
  const [reason, setReason] = useState("");

  const reload = useCallback(
    () =>
      getReviewPackage(projectId)
        .then((res) => {
          setPkg(res.data ?? null);
          setError(null);
        })
        .catch((err: unknown) => setError(L.errorText(err, t("loadFailed"))))
        .finally(() => setLoading(false)),
    // `L` đổi tham chiếu mỗi render — chỉ tải lại theo project
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (kind: "submit" | "changes" | "release", fn: (baseVersion: number) => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    setBlockingFlags([]);
    try {
      const spine = await getSpine(projectId);
      await fn(spine.data?.spine_version ?? 0);
      setAsking(null);
      setReason("");
      await reload();
      onChanged();
    } catch (err) {
      setError(L.errorText(err, t("actionFailed")));
      if (err instanceof ApiClientError && err.code === "RELEASE_RED_FLAGS_OPEN") setBlockingFlags((err.meta?.flags as Flag[] | undefined) ?? []);
      if (err instanceof ApiClientError && (err.code === "SPINE_VERSION_CONFLICT" || err.code === "PACKAGE_ALREADY_SUBMITTED")) await reload();
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="text-body text-[#8A867E]">{t("loading")}</p>;
  if (!pkg) return error ? <p role="alert" className="text-body text-[#B03030]">{error}</p> : null;

  const isLead = role === "lead";
  const canSubmit = (role === "lead" || role === "analyst") && pkg.status !== "pending";
  const count = pkg.change_requests.length;
  const pending = pkg.status === "pending";
  const submitBlocked = count === 0 ? t("blockedEmpty") : pkg.red_open > 0 ? t("blockedRed", { count: pkg.red_open }) : null;
  const btn = "px-3 py-1.5 rounded-[10px] text-body font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  return (
    <section className="flex flex-col gap-2.5" aria-label={t("aria")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-extrabold text-[#191817] text-body">{t("title")}</h3>
        <span
          className={`px-2 py-0.5 rounded-full text-caption font-bold ${
            pending ? "bg-[#F2F1FB] text-[#554DB0]" : pkg.status === "changes_requested" ? "bg-[#FDEDED] text-[#B03030]" : "bg-[#F0EEEA] text-[#4B4842]"
          }`}
        >
          {t(`status.${pkg.status}`)}
        </span>
      </div>
      {/* Bản nháp hiện "1.0 · 3 thay đổi chưa duyệt" — chỉ số chính (business-flow §2) */}
      <p className="text-heading font-extrabold text-[#191817]">{pkg.draft_label}</p>

      {pending && (
        <p role="status" className="text-body text-[#554DB0] bg-[#F2F1FB] border border-[#DCD8F0] rounded-[10px] px-3 py-2 leading-relaxed">
          {t("lockedNote")}
        </p>
      )}
      {pkg.status === "changes_requested" && pkg.submission?.reason && (
        <p role="status" className="text-body text-[#8A4141] bg-[#FDEDED] border border-[#F2CACA] rounded-[10px] px-3 py-2 leading-relaxed">
          {t("changesRequestedNote", { reason: pkg.submission.reason })}
        </p>
      )}

      {count > 0 ? (
        <ul className="flex flex-col gap-1" aria-label={t("listAria")}>
          {pkg.change_requests.map((cr) => (
            <li key={cr.cr_id} className="flex items-center gap-2 text-body">
              <Link href={crHref(projectId, cr.cr_id)} scroll={false} className="px-1.5 py-0.5 rounded bg-[#F0EEEA] text-[#4B4842] font-semibold hover:bg-[#E4E1DC]">
                {cr.cr_id}
              </Link>
              <span className="truncate text-[#191817]">{L.humanizeText(cr.title)}</span>
              <span className="ml-auto text-caption text-[#8A867E] whitespace-nowrap">{cr.requester}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-[#8A867E]">{t("empty")}</p>
      )}

      {error && (
        <div role="alert" className="text-body text-[#B03030] bg-[#FDEDED] border border-[#F2CACA] rounded-[10px] px-3 py-2">
          {error}
          {blockingFlags.length > 0 && (
            <ul className="list-disc pl-4 mt-1">
              {blockingFlags.map((f) => (
                <li key={f.id}>{L.humanizeText(f.message)}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {asking === "changes" && (
        <div className="flex flex-col gap-2 bg-[#FDF6E7] border border-[#F2E2BC] rounded-[10px] p-3">
          <label htmlFor="pkg-reason" className="text-body font-semibold text-[#191817]">
            {t("reasonLabel", { min: REASON_MIN })}
          </label>
          <textarea id="pkg-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 rounded-[8px] bg-white border border-[#ECEAE5] text-body outline-none resize-none" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAsking(null)} disabled={busy !== null} className={`${btn} border border-[#ECEAE5] bg-white text-[#4B4842]`}>
              {t("cancel")}
            </button>
            <button
              type="button"
              disabled={busy !== null || reason.trim().length < REASON_MIN}
              onClick={() => void run("changes", (v) => requestPackageChanges(projectId, v, reason.trim()))}
              className={`${btn} bg-[#B03030] text-white`}
            >
              {busy === "changes" ? t("sending") : t("confirmChanges")}
            </button>
          </div>
        </div>
      )}

      {asking === "release" && (
        <div className="flex flex-col gap-2 bg-[#F2F1FB] border border-[#DCD8F0] rounded-[10px] p-3 text-body text-[#554DB0]">
          <p>{t("confirmReleaseQuestion", { version: pkg.next_version ?? "", count })}</p>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAsking(null)} disabled={busy !== null} className={`${btn} border border-[#DCD8F0] bg-white text-[#4B4842]`}>
              {t("cancel")}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => void run("release", (v) => releaseDocument(projectId, v))} className={`${btn} bg-[#6A62C4] text-white`}>
              {busy === "release" ? t("releasing") : t("confirmRelease")}
            </button>
          </div>
        </div>
      )}

      {asking === null && (
        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <button
              type="button"
              disabled={busy !== null || submitBlocked !== null}
              title={submitBlocked ?? undefined}
              onClick={() => void run("submit", (v) => submitReviewPackage(projectId, v))}
              className={`${btn} btn-gradient-primary text-white`}
            >
              {busy === "submit" ? t("sending") : pkg.status === "changes_requested" ? t("resubmit") : t("submit")}
            </button>
          )}
          {isLead && pending && (
            <>
              <button type="button" disabled={busy !== null} onClick={() => setAsking("release")} className={`${btn} bg-[#6A62C4] text-white`}>
                {t("approveAll")}
              </button>
              <button type="button" disabled={busy !== null} onClick={() => setAsking("changes")} className={`${btn} border border-[#F2CACA] bg-white text-[#B03030]`}>
                {t("requestChanges")}
              </button>
            </>
          )}
          {isLead && !pending && (
            <button
              type="button"
              disabled={busy !== null || submitBlocked !== null}
              title={submitBlocked ?? undefined}
              onClick={() => setAsking("release")}
              className={`${btn} border border-[#DCD8F0] bg-white text-[#554DB0]`}
            >
              {t("releaseDirect")}
            </button>
          )}
        </div>
      )}
      {submitBlocked && asking === null && (canSubmit || isLead) && <p className="text-body text-[#8A6D1F]">{submitBlocked}</p>}
    </section>
  );
}
