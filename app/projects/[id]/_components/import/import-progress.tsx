"use client";

import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import type { ExtractionSection, HeadingMapEntry, ImportedDocument, ImportStatus } from "@/types/import";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { importSectionTitle, sortByFileOrder } from "./section-titles";

interface ImportProgressProps {
  doc: ImportedDocument;
  /** Tiến độ đọc nội dung theo mục (BE `extraction.sections`). */
  sections: ExtractionSection[];
  /** Heading của file (`profile.heading_map`) — chỉ để lấy tên mục hiển thị: mã mục đọc nội dung là mã khối heading (`@B1023`). */
  headings?: HeadingMapEntry[];
  busy?: boolean;
  onResume: () => void;
  /** Nút Dừng lúc đang đọc nội dung (`POST /import/pause`). */
  onPause?: () => void;
  pausing?: boolean;
  /**
   * FLF-411 U1-2: chế độ thật (BE `target_structure.resolved_mode`) và loại file (`structure_preview.summary.kind`). Chỉ chế độ 1
   * ghép thành bản gốc 0.1; chế độ 3 / 4 bắt đầu baseline 1.0 sau khi soạn (BF §2). Khung mẫu không có nội dung để trích.
   */
  resolvedMode?: 1 | 3 | 4 | null;
  fileKind?: "written" | "template" | null;
  /**
   * FLF-411 (U2-8): mã mục của màn đọc khung (`structure_preview.sections[].section_id`). Có ⇒ số mục và danh sách dòng chỉ
   * tính các mục đó, khớp số "x/y mục" của màn đọc khung — heading tính năng (`feature:@B…`) BE vẫn đọc nhưng màn đọc khung
   * coi là heading nhóm, không đếm. Mục đọc lỗi luôn hiện. Không có (import cũ) ⇒ đủ `extraction.sections` như trước.
   */
  previewSectionIds?: readonly string[] | null;
}

const PHASES = ["read", "build", "check"] as const;
type Phase = (typeof PHASES)[number];
type RowState = "done" | "active" | "todo" | "failed";

/** Pha hiện tại theo trạng thái import do BE trả — FE không tự suy tiến độ. */
const phaseOf = (status: ImportStatus): Phase => (status === "checking" ? "check" : status === "baselining" ? "build" : "read");


const ROW_LOOK: Record<RowState, { icon: "check-circle" | "spinner" | "error-circle" | null; className: string; pill: string }> = {
  done: { icon: "check-circle", className: "text-success", pill: "bg-success-soft text-success" },
  active: { icon: "spinner", className: "text-primary animate-spin", pill: "bg-primary-soft text-primary" },
  todo: { icon: null, className: "", pill: "bg-surface-container text-on-surface-muted" },
  failed: { icon: "error-circle", className: "text-on-error-container", pill: "bg-error-container text-on-error-container" },
};

/**
 * Tiến độ đọc file trong workspace — cùng ngôn ngữ với màn đọc khung: trái là trang tài liệu, mỗi mục một dòng với trạng thái
 * (đã đọc / đang đọc / chờ / lỗi) theo `extraction.sections` của BE, trang tự cuộn theo mục đang đọc; phải là số mục đã đọc và
 * ba bước Đọc nội dung → Dựng tài liệu → Kiểm tra. Chạy nền trên BE, rời trang được. Dừng ⇒ banner Tiếp tục; AI quá tải ⇒
 * dòng "đang đọc lại".
 */
export default function ImportProgress({ doc, sections: allSections, headings, busy = false, onResume, onPause, pausing = false, resolvedMode = null, fileKind = null, previewSectionIds = null }: ImportProgressProps) {
  const t = useTranslations("workspace.import.progress");
  const locale = useLocale() as Locale;
  const template = fileKind === "template";
  const hintKey = (phase: Phase): `phaseHint.${Phase | "buildDraft" | "readTemplate"}` =>
    phase === "read" && template ? "phaseHint.readTemplate" : phase === "build" && (template || (resolvedMode !== null && resolvedMode !== 1)) ? "phaseHint.buildDraft" : `phaseHint.${phase}`;
  const reduceMotion = useReducedMotion();
  const paperRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  const current = phaseOf(doc.status);
  const currentIndex = PHASES.indexOf(current);
  // Cùng tập mục với màn đọc khung (U2-8): số "x/y mục" chỉ đếm tập đó; mục lỗi ngoài tập vẫn hiện dòng để người dùng thấy
  const preview = useMemo(() => (previewSectionIds?.length ? new Set(previewSectionIds) : null), [previewSectionIds]);
  const counted = useMemo(() => (preview ? allSections.filter((s) => preview.has(s.section_id)) : allSections), [allSections, preview]);
  const sections = useMemo(() => (preview ? allSections.filter((s) => preview.has(s.section_id) || s.status === "failed") : allSections), [allSections, preview]);
  const done = counted.filter((s) => s.status === "done").length;
  const total = counted.length;
  // Tiêu đề theo mã khối heading và theo mã mục registry (heading đầu tiên khớp)
  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of headings ?? []) {
      map.set(h.block_id, h.heading_text);
      if (!map.has(h.section_id)) map.set(h.section_id, h.heading_text);
    }
    return map;
  }, [headings]);
  // `feature:@B1023` / `function:@B1023` ⇒ khối B1023; `fixed:2.1` ⇒ mục registry
  const titleOf = (id: string) => importSectionTitle(id, id.includes("@") ? titles.get(id.slice(id.lastIndexOf("@") + 1)) : titles.get(id), locale);
  // Thứ tự theo file (như màn đọc khung), không theo thứ tự BE đọc
  const ordered = useMemo(() => sortByFileOrder(sections, headings), [sections, headings]);
  // Mục đang đọc = mục chờ đầu tiên khi còn ở pha đọc và không dừng (BE đọc lần lượt)
  const stoppedByUser = doc.paused?.reason === "user";
  /** Loại thẻ dừng: người dùng dừng · hết credit · bước chạy nền bị gián đoạn (máy chủ khởi động lại / job lỗi) · AI lỗi. */
  const pauseKind = !doc.paused ? null : stoppedByUser ? "user" : doc.paused.reason === "credits" ? "credits" : doc.status === "baselining" ? "interrupted" : "ai";
  // Dừng chỉ có ở bước đọc nội dung (bước tốn credit theo từng mục), khi đang chạy
  const canStop = !!onPause && current === "read" && !doc.paused;
  const activeId = current === "read" && !doc.paused ? allSections.find((s) => s.status === "pending")?.section_id : undefined;

  // Trang tự cuộn để mục đang đọc luôn trong tầm mắt
  useEffect(() => {
    const paper = paperRef.current;
    const row = activeRef.current;
    if (!paper || !row) return;
    const top = row.offsetTop;
    if (top >= paper.scrollTop && top + row.offsetHeight <= paper.scrollTop + paper.clientHeight) return;
    paper.scrollTo({ top: Math.max(top - paper.clientHeight / 3, 0), behavior: reduceMotion ? "auto" : "smooth" });
  }, [activeId, reduceMotion]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 max-w-[680px]">
        <p className="flex items-center gap-2 text-body min-w-0">
          <span className="w-7 h-7 shrink-0 rounded-inner bg-primary-soft text-primary flex items-center justify-center">
            <Icon name="file" size={15} />
          </span>
          <span className="truncate font-medium text-on-surface" title={doc.original_name}>
            {doc.original_name}
          </span>
        </p>
        <h2 className="flex items-center gap-2.5 text-title font-bold text-on-surface">
          {!doc.paused && <Icon name="spinner" size={20} className="text-primary animate-spin" />}
          {pauseKind === "user" ? t("stopped.title") : pauseKind ? t("pausedTitle") : t("title")}
        </h2>
        {!doc.paused && <p className="text-body text-on-surface-variant leading-relaxed">{t("canLeave")}</p>}
      </header>

      {/* Đang dừng (mọi lý do): một thẻ phẳng, câu theo lý do — phần đã xong giữ nguyên, Tiếp tục chạy tiếp từ chỗ dừng */}
      {pauseKind && doc.paused && (
        <div role="status" className={`flex flex-wrap items-center gap-3 rounded-card px-4 py-3 ${pauseKind === "credits" ? "bg-accent-gold-soft" : "bg-surface-container"}`}>
          <span
            className={`w-9 h-9 shrink-0 rounded-control flex items-center justify-center ${pauseKind === "credits" ? "bg-surface-container-lowest text-accent-gold-text" : "bg-surface-container-lowest text-on-surface-variant"}`}
          >
            <Icon name={pauseKind === "user" ? "pause" : pauseKind === "credits" ? "savings" : "cloud-off"} size={18} />
          </span>
          <div className="flex-1 min-w-[220px] flex flex-col gap-0.5">
            {pauseKind !== "user" && <p className="text-body font-semibold text-on-surface">{t(`pause.${pauseKind}.title`, { phase: t(`phase.${current}`) })}</p>}
            <p className="text-body text-on-surface-variant">
              {pauseKind === "user" ? t("stopped.body", { done, total }) : t(`pause.${pauseKind}.body`)}
            </p>
          </div>
          {pauseKind === "credits" && (
            <Link href="/home/billing" className="text-body font-bold text-primary hover:underline">
              {t("pause.credits.topUp")}
            </Link>
          )}
          <Button onClick={onResume} loading={busy} icon="play">
            {busy ? t("stopped.resuming") : t("stopped.resume")}
          </Button>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {t(`phase.${current}`)}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
        {/* Trang tài liệu: từng mục và trạng thái đọc — cao theo nội dung, tối đa phần còn trống của màn hình (cả trang gọn một màn) rồi cuộn bên trong; cột phải kéo dài cho bằng đáy */}
        <section aria-label={t("documentLabel")} className="flex flex-col gap-2 min-w-0">
          <h3 className="min-h-6 flex items-center text-body font-bold text-on-surface-medium">{t("documentLabel")}</h3>
          <div className="flex-1 min-h-0 flex flex-col rounded-card bg-surface-container-lowest shadow-[0_1px_2px_rgba(30,25,60,0.06),0_10px_30px_-14px_rgba(30,25,60,0.22)] overflow-hidden">
            <div ref={paperRef} className="overflow-y-auto ff-scroll" style={{ maxHeight: "max(320px, calc(100dvh - 400px))" }}>
              {sections.length === 0 ? (
                <p className="px-8 py-10 text-body text-on-surface-muted">{t("noSections")}</p>
              ) : (
                <ol className="relative flex flex-col px-5 sm:px-7 py-5 gap-0.5">
                  {ordered.map((s) => {
                    const state: RowState = s.status === "done" ? "done" : s.status === "failed" ? "failed" : s.section_id === activeId ? "active" : "todo";
                    const look = ROW_LOOK[state];
                    return (
                      <li
                        key={s.section_id}
                        ref={state === "active" ? activeRef : undefined}
                        aria-current={state === "active" ? "true" : undefined}
                        className={`flex items-start gap-3 rounded-inner px-3 py-2.5 transition-colors duration-300 ${state === "active" ? "bg-primary-soft" : ""}`}
                      >
                        <span className="w-4 h-4 mt-[3px] shrink-0 flex items-center justify-center">
                          {look.icon ? <Icon name={look.icon} size={15} className={look.className} /> : <span className="w-1.5 h-1.5 rounded-full bg-on-surface/20" />}
                        </span>
                        <span className="flex-1 min-w-0 flex flex-col gap-1.5">
                          <span className={`text-body font-semibold truncate ${state === "todo" ? "text-on-surface-muted" : "text-on-surface"}`} title={titleOf(s.section_id)}>
                            {titleOf(s.section_id)}
                          </span>
                          {/* Dòng chữ giả: đã đọc ⇒ đậm, chưa ⇒ mờ — trang "đầy" dần theo tiến độ */}
                          <span aria-hidden className="flex flex-col gap-1">
                            <span className={`h-1.5 w-11/12 rounded-full ${state === "done" ? "bg-on-surface/[0.09]" : "bg-on-surface/[0.04]"}`} />
                            <span className={`h-1.5 w-3/5 rounded-full ${state === "done" ? "bg-on-surface/[0.09]" : "bg-on-surface/[0.04]"}`} />
                          </span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-medium ${look.pill}`}>{t(`row.${state}`)}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </section>

        {/* Số mục đã đọc + ba bước */}
        <section aria-label={t("phasesLabel")} className="flex flex-col gap-2 min-w-0">
          <h3 className="min-h-6 flex items-center text-body font-bold text-on-surface-medium">{t("phasesLabel")}</h3>
          <div className="flex-1 flex flex-col gap-1.5 rounded-card bg-surface-container p-1.5">
            {total > 0 && (
              <div className="rounded-control bg-surface-container-lowest px-4 py-4 flex flex-col gap-3">
                <p className="flex items-baseline gap-2">
                  <span className="text-metric font-bold text-on-surface tabular-nums">
                    {done}
                    <span className="text-on-surface-muted">/{total}</span>
                  </span>
                  <span className="text-body text-on-surface-variant">{t("readCount")}</span>
                </p>
                <span aria-hidden className="h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                  <span className="block h-full w-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out" style={{ transform: `scaleX(${done / total})` }} />
                </span>
              </div>
            )}
            <ol className="flex flex-col">
              {PHASES.map((phase, i) => {
                const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "todo";
                return (
                  <li key={phase} aria-current={state === "active" ? "step" : undefined} className="relative flex items-start gap-3 px-3 py-3">
                    {/* Đường nối giữa các bước */}
                    {i < PHASES.length - 1 && <span aria-hidden className={`absolute left-[23px] top-9 bottom-[-6px] w-0.5 rounded-full ${state === "done" ? "bg-success" : "bg-surface-container-highest"}`} />}
                    <span
                      className={`relative w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${
                        state === "done" ? "bg-success text-on-primary" : state === "active" ? "bg-primary text-on-primary" : "bg-surface-container-highest text-on-surface-muted"
                      }`}
                    >
                      {state === "done" ? (
                        <Icon name="check" size={13} />
                      ) : state === "active" && !doc.paused ? (
                        <Icon name="spinner" size={13} className="animate-spin" />
                      ) : (
                        <span className="text-caption font-bold tabular-nums">{i + 1}</span>
                      )}
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className={`text-body font-semibold ${state === "todo" ? "text-on-surface-muted" : "text-on-surface"}`}>{t(`phase.${phase}`)}</span>
                      <span className="text-caption text-on-surface-muted">{t(hintKey(phase))}</span>
                    </span>
                    <span className="sr-only">{t(`state.${state}`)}</span>
                  </li>
                );
              })}
            </ol>
            {canStop && (
              <div className="flex flex-wrap items-center gap-2 px-3 pt-1 pb-2">
                <Button size="sm" variant="secondary" icon="pause" onClick={onPause} loading={pausing}>
                  {pausing ? t("stop.busy") : t("stop.label")}
                </Button>
                <span className="text-caption text-on-surface-muted">{t("stop.hint")}</span>
              </div>
            )}
            {doc.reread && (
              <p role="status" aria-live="polite" className="flex items-center gap-2 px-3 pb-2 text-caption text-on-surface-muted">
                <Icon name="refresh" size={14} />
                {t(doc.reread.kind === "images" ? "reread.images" : "reread.text", { done: doc.reread.done, total: doc.reread.total })}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
