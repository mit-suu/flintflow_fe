"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Spine } from "@/types/spine";
import type { DocumentLanguage } from "@/types/project";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/tooltip";
import { assumptionText, briefVisionGoals, formFactorLabel, formFactorList, isBriefCoreTopic, stakesLabel } from "./brief-labels";

interface BriefPanelProps {
  spine: Pick<Spine, "project" | "assumptions" | "addendum"> | null;
  /** AI đang chạy một bước của pha Brief — panel sẽ đổi sau khi bước ghi xong. */
  updating?: boolean;
  /** Bề rộng cột, do tay kéo ở workspace quyết (pha Brief: chat co giãn, cột này cố định). */
  width?: number;
  /** Ngôn ngữ tài liệu của dự án — khác ngôn ngữ giao diện ⇒ tầm nhìn / mục tiêu hiện như đoạn trích tài liệu. */
  documentLanguage?: DocumentLanguage | null;
}

/** Tooltip nền tối của khung Tóm tắt — vẽ qua portal nên không bị cột cuộn cắt. */
function Tip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        collisionPadding={8}
        className="max-w-[260px] bg-inverse-surface text-inverse-on-surface [&_svg]:bg-inverse-surface [&_svg]:fill-inverse-surface"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/** Nhãn có giải thích: rê chuột hoặc focus bàn phím vào nhãn thì hiện câu giải thích. */
function TipLabel({ label, tip }: { label: string; tip?: string }) {
  if (!tip) return <span>{label}</span>;
  return (
    <Tip text={tip}>
      <span
        tabIndex={0}
        className="cursor-help rounded-inner underline decoration-dotted decoration-on-surface-muted underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
      >
        {label}
      </span>
    </Tip>
  );
}

/** Một ô thông tin: nhãn nhỏ phía trên, nội dung phía dưới, nền fill (không viền, không bóng). */
function Tile({ label, tip, children, excerpt, className = "" }: { label: string; tip?: string; children: ReactNode; excerpt?: DocExcerpt; className?: string }) {
  return (
    // Đoạn trích tài liệu nền trắng như trang tài liệu (không lồng thêm lớp nền); ô thông tin thường nền xám
    <div className={`${excerpt ? "bg-surface-container-lowest" : "bg-surface-container"} rounded-card px-4 py-2.5 flex flex-col gap-1 min-w-0 ${className}`}>
      <dt className="flex items-center justify-between gap-2 text-caption font-semibold text-on-surface-variant">
        <TipLabel label={label} tip={tip} />
        {excerpt ? (
          // Thẻ mã ngôn ngữ (không chỉ dựa vào màu): nội dung bên dưới lấy từ bản dự phòng, viết theo ngôn ngữ tài liệu
          <Tip text={excerpt.title}>
            <span
              tabIndex={0}
              className="shrink-0 cursor-help rounded-full bg-primary-soft px-2 text-[11px] font-semibold leading-[18px] text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              {excerpt.badge}
            </span>
          </Tip>
        ) : null}
      </dt>
      {excerpt ? (
        // Đoạn trích tài liệu: một lớp nền như các ô khác, chữ thường như khung tài liệu; `lang` đúng ngôn ngữ cho trình đọc màn hình
        <dd lang={excerpt.lang} className="min-w-0 text-body font-normal leading-relaxed text-on-surface">
          {children}
        </dd>
      ) : (
        <dd className="text-heading font-semibold text-on-surface min-w-0">{children}</dd>
      )}
    </div>
  );
}

/** Nhãn của đoạn trích tài liệu khi ngôn ngữ tài liệu khác ngôn ngữ giao diện. */
interface DocExcerpt {
  lang: DocumentLanguage;
  badge: string;
  title: string;
}

/** Brief đã có gì để hiện chưa — chưa có thì workspace ẩn hẳn khung này (khung chat chiếm chỗ). */
export const briefHasData = (spine: Pick<Spine, "project" | "assumptions" | "addendum">): boolean => {
  const project = spine.project;
  return Boolean(
    project.system_name?.trim() ||
      formFactorList(project.form_factor).length ||
      project.stakes ||
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
export default function BriefPanel({ spine, updating = false, width = 400, documentLanguage = null }: BriefPanelProps) {
  const t = useTranslations("workspace.brief.panel");
  const tLabel = useTranslations("workspace.briefLabels");
  const locale = useLocale();
  const tLanguage = useTranslations("common.documentLanguage");
  const headingId = "brief-panel-title";
  // Điều AI đang tạm hiểu mà bạn chưa xác nhận — chỉ đọc; sửa hay xác nhận bằng cách nhắn ở ô chat
  const understood = (spine?.assumptions ?? []).filter((a) => a.status === "unconfirmed");
  const project = spine?.project;
  const formFactor = formFactorLabel(project?.form_factor, tLabel);
  const stakes = stakesLabel(project?.stakes, tLabel);
  const systemName = project?.system_name?.trim();
  const { vision, goals, fromProject } = spine ? briefVisionGoals(spine) : { vision: null, goals: [], fromProject: false };
  // Chỉ bản dự phòng (`project.vision` / `project.goals` của dự án cũ, import, mẫu) viết theo ngôn ngữ tài liệu; lấy từ
  // chat thì là lời user ⇒ giữ ô xám thường. Bản dự phòng khác ngôn ngữ giao diện ⇒ hiện như đoạn trích, kèm thẻ mã ngôn ngữ.
  const excerpt: DocExcerpt | undefined =
    fromProject && documentLanguage && documentLanguage !== locale
      ? { lang: documentLanguage, badge: t("docExcerpt", { code: documentLanguage.toUpperCase() }), title: t("docExcerptTitle", { language: tLanguage(documentLanguage) }) }
      : undefined;
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
              <Icon name="layers" size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 id={headingId} className="text-subtitle font-bold tracking-tight text-on-surface">
                  {t("title")}
                </h2>
                <Tip text={t("titleTip")}>
                  <button
                    type="button"
                    aria-label={t("titleTip")}
                    className="shrink-0 rounded-full text-on-surface-muted hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Icon name="info" size={16} />
                  </button>
                </Tip>
              </div>
              <p className="text-body text-on-surface-variant">{t("subtitle")}</p>
            </div>
            <p aria-live="polite" className="shrink-0 text-body font-semibold text-primary">
              {updating ? (
                <span className="inline-flex items-center gap-1.5 bg-primary-soft rounded-full px-2.5 py-1">
                  <Icon name="spinner" size={12} className="animate-spin motion-reduce:animate-none" />
                  {t("updating")}
                </span>
              ) : null}
            </p>
          </header>

          {!spine ? (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label={t("loadingAria")}>
              <Skeleton className="h-16 w-full rounded-card" />
              <Skeleton className="h-16 w-full rounded-card" />
              <Skeleton className="h-24 w-full rounded-card" />
            </div>
          ) : (
            <>

              {hasProjectInfo ? (
                <dl className="grid grid-cols-1 gap-2.5">
                  {systemName ? (
                    <Tile label={t("systemName")}>
                      <span className="text-subtitle font-bold text-on-surface break-words">{systemName}</span>
                    </Tile>
                  ) : null}
                  {/* Chỉ có một trong hai ô ngắn ⇒ ô đó chiếm cả hàng cho khỏi lệch. */}
                  {formFactor ? (
                    <Tile label={t("platform")}>
                      {formFactor}
                    </Tile>
                  ) : null}
                  {stakes ? (
                    <Tile label={t("stakes")} tip={t("stakesTip")}>
                      {stakes}
                    </Tile>
                  ) : null}
                  {vision ? (
                    <Tile label={t("vision")} tip={t("visionTip")} excerpt={excerpt}>
                      <p className="leading-relaxed">{vision}</p>
                    </Tile>
                  ) : null}
                  {goals.length ? (
                    <Tile label={t("goalsCount", { count: goals.length })} tip={t("goalsTip")} excerpt={excerpt}>
                      <ul className="flex flex-col gap-1 leading-relaxed">
                        {goals.map((goal) => (
                          <li key={goal.id} className="flex gap-2">
                            {/* Chấm tròn như "Điều bạn đã kể" — dấu tích dễ bị hiểu là mục tiêu đã đạt */}
                            <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-on-surface-muted" />
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
                    <TipLabel label={t("notesCount", { count: notes.length })} tip={t("notesTip")} />
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
                    <TipLabel label={t("understoodCount", { count: understood.length })} tip={t("understoodTip")} />
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {understood.map((assumption) => (
                      <li key={assumption.id} className="flex gap-2 text-body text-on-surface leading-relaxed">
                        <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-on-surface-muted" />
                        <span className="min-w-0">{assumptionText(assumption, locale)}</span>
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
