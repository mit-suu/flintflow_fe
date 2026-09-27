"use client";

import type { ReactNode } from "react";
import type { Assumption, Spine } from "@/types/spine";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import { ASSUMPTION_STATUS_LABEL, assumptionText, formFactorLabel, stakesLabel } from "./brief-labels";

interface BriefPanelProps {
  spine: Pick<Spine, "project" | "assumptions"> | null;
  /** AI đang chạy một bước của pha Brief — panel sẽ đổi sau khi bước ghi xong. */
  updating?: boolean;
}

const EMPTY = "Chưa có — AI sẽ hỏi khi cần";

const STATUS_TONE: Record<Assumption["status"], string> = {
  unconfirmed: "bg-accent-gold-soft text-accent-gold-text",
  confirmed: "bg-success-soft text-success",
  rejected: "bg-surface-container-high text-on-surface-muted",
};

/** Một ô thông tin: nhãn nhỏ phía trên, nội dung phía dưới, nền fill (không viền, không bóng). */
function Tile({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-container-low rounded-card px-4 py-3 flex flex-col gap-1 min-w-0 ${className}`}>
      <dt className="text-[11px] font-semibold text-on-surface-muted">{label}</dt>
      <dd className="text-[13px] text-on-surface min-w-0">{children}</dd>
    </div>
  );
}

const Empty = () => <span className="text-[12px] italic text-on-surface-muted">{EMPTY}</span>;

/**
 * Khung phải ở pha Brief (B-0…B-2, FLF-221): "Brief đang hình thành" — những gì AI đã hiểu về ý tưởng, đọc thẳng từ
 * Spine. Cố ý KHÔNG giống tài liệu SRS (không trang giấy, không mục đánh số, không nút tải/phiên bản): user chưa có SRS
 * nào ở pha này, chỉ có ý tưởng đang được chốt dần. SRS pane quay lại từ S-1.
 */
export default function BriefPanel({ spine, updating = false }: BriefPanelProps) {
  const headingId = "brief-panel-title";
  const assumptions = spine?.assumptions ?? [];
  const project = spine?.project;
  const formFactor = formFactorLabel(project?.form_factor);
  const stakes = stakesLabel(project?.stakes);

  return (
    <section aria-labelledby={headingId} className="flex-1 bg-surface-container-lowest flex flex-col min-w-[320px] overflow-hidden">
      <div className="flex-1 overflow-y-auto ff-scroll px-6 py-6">
        <div className="max-w-[600px] mx-auto flex flex-col gap-4">
          <header className="flex items-start gap-3">
            <span aria-hidden className="size-9 shrink-0 rounded-control bg-primary-soft text-primary flex items-center justify-center">
              <Icon name="sparkle" size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <h2 id={headingId} className="text-[15px] font-bold text-on-surface">
                Brief đang hình thành
              </h2>
              <p className="text-[12px] text-on-surface-muted">Tóm tắt ý tưởng — chưa phải tài liệu SRS</p>
            </div>
            <p aria-live="polite" className="shrink-0 text-[11.5px] font-semibold text-primary">
              {updating ? (
                <span className="inline-flex items-center gap-1.5 bg-primary-soft rounded-full px-2.5 py-1">
                  <Icon name="spinner" size={12} className="animate-spin motion-reduce:animate-none" />
                  AI đang cập nhật
                </span>
              ) : null}
            </p>
          </header>

          {!spine ? (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Đang tải Brief">
              <Skeleton className="h-16 w-full rounded-card" />
              <Skeleton className="h-16 w-full rounded-card" />
              <Skeleton className="h-24 w-full rounded-card" />
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Tile label="Tên hệ thống" className="sm:col-span-2">
                  {project?.system_name?.trim() ? (
                    <span className="text-[16px] font-bold text-on-surface break-words">{project.system_name}</span>
                  ) : (
                    <Empty />
                  )}
                </Tile>
                <Tile label="Nền tảng">{formFactor ?? <Empty />}</Tile>
                <Tile label="Mức độ quan trọng">{stakes ?? <Empty />}</Tile>
                <Tile label="Tầm nhìn" className="sm:col-span-2">
                  {project?.vision?.trim() ? <p className="leading-relaxed">{project.vision}</p> : <Empty />}
                </Tile>
                <Tile label={`Mục tiêu${project?.goals.length ? ` (${project.goals.length})` : ""}`} className="sm:col-span-2">
                  {project?.goals.length ? (
                    <ul className="flex flex-col gap-1 leading-relaxed">
                      {project.goals.map((goal) => (
                        <li key={goal} className="flex gap-2">
                          <Icon name="check" size={14} className="mt-0.5 shrink-0 text-primary" />
                          <span>{goal}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty />
                  )}
                </Tile>
              </dl>

              <section aria-labelledby="brief-panel-assumptions" className="bg-surface-container-low rounded-card px-4 py-3 flex flex-col gap-2">
                <h3 id="brief-panel-assumptions" className="text-[11px] font-semibold text-on-surface-muted">
                  Giả định AI đang dùng{assumptions.length ? ` (${assumptions.length})` : ""}
                </h3>
                {assumptions.length === 0 ? (
                  <p className="text-[12px] italic text-on-surface-muted">Chưa có giả định nào — AI ghi lại mỗi khi phải tự điền một điều bạn chưa nói.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {assumptions.map((assumption) => (
                      <li key={assumption.id} className="flex items-start gap-2 text-[12.5px] text-on-surface leading-relaxed">
                        <span className="flex-1 min-w-0">{assumptionText(assumption)}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_TONE[assumption.status]}`}>
                          {ASSUMPTION_STATUS_LABEL[assumption.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
