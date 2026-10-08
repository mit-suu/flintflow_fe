"use client";

import type { ReactNode } from "react";
import type { Spine } from "@/types/spine";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import { assumptionText, briefVisionGoals, formFactorLabel, isBriefCoreTopic, stakesLabel } from "./brief-labels";

interface BriefPanelProps {
  spine: Pick<Spine, "project" | "assumptions" | "addendum"> | null;
  /** AI đang chạy một bước của pha Brief — panel sẽ đổi sau khi bước ghi xong. */
  updating?: boolean;
  /** Bề rộng cột, do tay kéo ở workspace quyết (pha Brief: chat co giãn, cột này cố định). */
  width?: number;
}

/** Một ô thông tin: nhãn nhỏ phía trên, nội dung phía dưới, nền fill (không viền, không bóng). */
function Tile({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-container rounded-card px-4 py-2.5 flex flex-col gap-1 min-w-0 ${className}`}>
      <dt className="text-caption font-semibold text-on-surface-variant">{label}</dt>
      <dd className="text-heading font-semibold text-on-surface min-w-0">{children}</dd>
    </div>
  );
}

/** Brief đã có gì để hiện chưa — chưa có thì workspace ẩn hẳn khung này (khung chat chiếm chỗ). */
export const briefHasData = (spine: Pick<Spine, "project" | "assumptions" | "addendum">): boolean => {
  const project = spine.project;
  return Boolean(
    project.system_name?.trim() ||
      formFactorLabel(project.form_factor) ||
      stakesLabel(project.stakes) ||
      briefVisionGoals(spine).vision ||
      briefVisionGoals(spine).goals.length ||
      spine.addendum.some((entry) => entry.content.trim() !== "") ||
      spine.assumptions.length
  );
};

/**
 * Khung phải ở pha Brief (B-0…B-2, FLF-221): "Tóm tắt đang hình thành" — những gì AI đã hiểu về ý tưởng, đọc thẳng từ
 * Spine. Cố ý KHÔNG giống tài liệu SRS (không trang giấy, không mục đánh số, không nút tải/phiên bản): user chưa có SRS
 * nào ở pha này, chỉ có ý tưởng đang được chốt dần. SRS pane quay lại từ S-1.
 */
export default function BriefPanel({ spine, updating = false, width = 400 }: BriefPanelProps) {
  const headingId = "brief-panel-title";
  // Điều AI đang tạm hiểu mà bạn chưa xác nhận — chỉ đọc; sửa hay xác nhận bằng cách nhắn ở ô chat
  const understood = (spine?.assumptions ?? []).filter((a) => a.status === "unconfirmed");
  const project = spine?.project;
  const formFactor = formFactorLabel(project?.form_factor);
  const stakes = stakesLabel(project?.stakes);
  const systemName = project?.system_name?.trim();
  const { vision, goals } = spine ? briefVisionGoals(spine) : { vision: null, goals: [] };
  // Điều user đã kể mà chưa thành field của project (mục đích, người dùng, quy mô…) — bằng chính lời user
  const notes = (spine?.addendum ?? []).filter((entry) => entry.content.trim() !== "" && !isBriefCoreTopic(entry.topic));
  // Ô nào chưa có dữ liệu thì ẩn hẳn. Brief chưa có gì thì workspace không dựng khung này (`briefHasData`); skeleton
  // chỉ còn cho lúc đang tải Spine.
  const hasProjectInfo = Boolean(systemName || formFactor || stakes || vision || goals.length);

  return (
    <section
      id="workspace-brief-panel"
      aria-labelledby={headingId}
      style={{ width }}
      className="shrink-0 bg-surface-container-lowest flex flex-col overflow-hidden"
    >
      <div className="flex-1 overflow-y-auto ff-scroll px-5 py-6">
        <div className="flex flex-col gap-4">
          <header className="flex items-start gap-3">
            <span aria-hidden className="size-9 shrink-0 rounded-control bg-primary-soft text-primary flex items-center justify-center">
              <Icon name="sparkle" size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <h2 id={headingId} className="text-subtitle font-bold tracking-tight text-on-surface">
                Tóm tắt đang hình thành
              </h2>
              <p className="text-body text-on-surface-variant">Tóm tắt ý tưởng — chưa phải tài liệu SRS</p>
            </div>
            <p aria-live="polite" className="shrink-0 text-body font-semibold text-primary">
              {updating ? (
                <span className="inline-flex items-center gap-1.5 bg-primary-soft rounded-full px-2.5 py-1">
                  <Icon name="spinner" size={12} className="animate-spin motion-reduce:animate-none" />
                  AI đang cập nhật
                </span>
              ) : null}
            </p>
          </header>

          {!spine ? (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Đang tải tóm tắt">
              <Skeleton className="h-16 w-full rounded-card" />
              <Skeleton className="h-16 w-full rounded-card" />
              <Skeleton className="h-24 w-full rounded-card" />
            </div>
          ) : (
            <>

              {hasProjectInfo ? (
                <dl className="grid grid-cols-1 gap-2.5">
                  {systemName ? (
                    <Tile label="Tên hệ thống">
                      <span className="text-subtitle font-bold text-on-surface break-words">{systemName}</span>
                    </Tile>
                  ) : null}
                  {/* Chỉ có một trong hai ô ngắn ⇒ ô đó chiếm cả hàng cho khỏi lệch. */}
                  {formFactor ? (
                    <Tile label="Nền tảng">
                      {formFactor}
                    </Tile>
                  ) : null}
                  {stakes ? (
                    <Tile label="Mức độ quan trọng">
                      {stakes}
                    </Tile>
                  ) : null}
                  {vision ? (
                    <Tile label="Tầm nhìn">
                      <p className="leading-relaxed">{vision}</p>
                    </Tile>
                  ) : null}
                  {goals.length ? (
                    <Tile label={`Mục tiêu (${goals.length})`}>
                      <ul className="flex flex-col gap-1 leading-relaxed">
                        {goals.map((goal) => (
                          <li key={goal.id} className="flex gap-2">
                            <Icon name="check" size={14} className="mt-0.5 shrink-0 text-primary" />
                            <span>{goal.text}</span>
                          </li>
                        ))}
                      </ul>
                    </Tile>
                  ) : null}
                </dl>
              ) : null}

              {notes.length ? (
                <section aria-labelledby="brief-panel-notes" className="bg-surface-container rounded-card px-4 py-2.5 flex flex-col gap-2">
                  <h3 id="brief-panel-notes" className="text-caption font-semibold text-on-surface-variant">
                    Điều bạn đã kể ({notes.length})
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {notes.map((entry) => (
                      <li key={entry.id} className="flex gap-2 text-body text-on-surface leading-relaxed">
                        <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-on-surface-muted" />
                        <span className="min-w-0">{entry.content}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {understood.length ? (
                <section aria-labelledby="brief-panel-understood" className="bg-surface-container rounded-card px-4 py-2.5 flex flex-col gap-2">
                  <h3 id="brief-panel-understood" className="text-caption font-semibold text-on-surface-variant">
                    Những điều tôi đang hiểu ({understood.length})
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {understood.map((assumption) => (
                      <li key={assumption.id} className="flex gap-2 text-body text-on-surface leading-relaxed">
                        <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-on-surface-muted" />
                        <span className="min-w-0">{assumptionText(assumption)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
