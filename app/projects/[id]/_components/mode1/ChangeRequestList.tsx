"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listCrs } from "@/lib/api/change-requests";
import { CR_TERMINAL_STATUSES, type Cr } from "@/types/change-request";
import ChangeRequestForm from "./ChangeRequestForm";
import { errorText } from "./errors";
import { CR_SOURCE_LABELS, CR_STATUS_LABELS, formatDateTime } from "./labels";
import type { CrPrefill } from "./prefill";

interface ChangeRequestListProps {
  projectId: string;
  /** Điền sẵn từ gap report / re-upload / chat (`?new=1&…`) ⇒ mở form ngay. */
  prefill: CrPrefill | null;
}

type Filter = "open" | "closed" | "all";

export const statusTone = (status: Cr["status"]): string =>
  status === "written"
    ? "bg-[#E9F7EE] text-[#1F7A45]"
    : status === "rejected" || status === "cancelled"
      ? "bg-[#F0EEEA] text-[#8A867E]"
      : status === "manual_fix" || status === "awaiting_answers" || status === "in_review"
        ? "bg-[#FBF4E4] text-[#8A6D1F]"
        : "bg-[#F4F3FE] text-[#3B34B0]";

/** Danh sách change request + tạo mới (UC-48). */
export default function ChangeRequestList({ projectId, prefill }: ChangeRequestListProps) {
  const router = useRouter();
  const [crs, setCrs] = useState<Cr[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(prefill !== null);
  const [filter, setFilter] = useState<Filter>("open");

  const load = useCallback(
    () =>
      listCrs(projectId)
        .then((res) => setCrs(res.data ?? []))
        .catch((err: unknown) => setError(errorText(err, "Không tải được danh sách change request"))),
    [projectId]
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
          <h2 className="text-[20px] font-extrabold text-[#191817]">Change request</h2>
          <p className="text-[12px] text-[#8A867E]">Tài liệu đã có baseline — mọi sửa đổi đi qua change request: làm rõ, tìm vị trí, đề xuất, kiểm, duyệt rồi ghi Track Changes.</p>
        </div>
        {!formOpen && (
          <button type="button" onClick={() => setFormOpen(true)} className="px-4 py-2 rounded-full btn-gradient-primary text-white text-[12.5px] font-bold cursor-pointer">
            + Tạo change request
          </button>
        )}
      </div>

      {formOpen && (
        <ChangeRequestForm
          projectId={projectId}
          prefill={prefill}
          onCancel={() => setFormOpen(false)}
          onCreated={(d) => router.push(`/projects/${projectId}/change-requests/${d.change_request.cr_id}`)}
        />
      )}

      {error && (
        <p role="alert" className="text-[12.5px] text-[#B03030]">
          {error}
        </p>
      )}

      <div className="flex gap-1.5" role="group" aria-label="Lọc change request">
        {(["open", "closed", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-[12px] font-bold ${filter === f ? "bg-[#191817] text-white" : "bg-white border border-[#ECEAE5] text-[#6B6862]"}`}
          >
            {f === "open" ? "Đang mở" : f === "closed" ? "Đã xong / đóng" : "Tất cả"}
          </button>
        ))}
      </div>

      {crs === null ? (
        <p className="text-[13px] text-[#8A867E]">Đang tải…</p>
      ) : shown.length === 0 ? (
        <p className="text-[13px] text-[#8A867E] bg-white border border-[#ECEAE5] rounded-[14px] px-4 py-6 text-center">Chưa có change request nào ở mục này.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((c) => (
            <li key={c.cr_id}>
              <Link
                href={`/projects/${projectId}/change-requests/${c.cr_id}`}
                className="bg-white border border-[#ECEAE5] rounded-[14px] px-4 py-3 flex flex-wrap items-center gap-3 hover:shadow-[0_8px_20px_rgba(25,24,23,0.06)] transition-shadow"
              >
                <code className="text-[12px] font-bold text-[#4F46E5]">{c.cr_id}</code>
                <span className="flex-1 min-w-[200px] font-bold text-[#191817] text-[13.5px] truncate">{c.title}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusTone(c.status)}`}>{CR_STATUS_LABELS[c.status]}</span>
                {c.paused && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FDEDED] text-[#B03030]">Tạm dừng</span>}
                <span className="w-full text-[11.5px] text-[#8A867E]">
                  {CR_SOURCE_LABELS[c.source.kind]}
                  {c.source.ref ? ` · ${c.source.ref}` : ""} · {c.requester} · {formatDateTime(c.created_at)}
                  {c.result_doc_version ? ` · ghi vào bản ${c.result_doc_version}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
