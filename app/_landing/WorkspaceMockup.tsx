"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

/*
 * Mockup cửa sổ workspace — minh hoạ, không gọi API. Tab chuyển giữa tài liệu (diff + inline
 * annotation) và audit log. Dữ liệu là ví dụ "Cổng cấp phép xây dựng" trong context/business-flow.md §7.
 * Nội dung tài liệu (outline, diff) luôn tiếng Anh như SRS thật; chỉ khung UI đi qua `landing.mockup` (T25).
 */

const TABS = [
  { id: "doc", file: "srs_v2.4.docx" },
  { id: "log", file: "audit_log.json" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const OUTLINE = [
  { id: "3.2.3", label: "Look up applications", flags: 0 },
  { id: "3.2.4", label: "Submit permit application", flags: 1, active: true },
  { id: "3.2.5", label: "Review application", flags: 0 },
  { id: "4.1", label: "Performance", flags: 0 },
];

export default function WorkspaceMockup() {
  const t = useTranslations("landing");
  const [tab, setTab] = useState<TabId>("doc");

  return (
    <figure
      aria-label={t("a11y.workspace")}
      className="overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900/60 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]"
    >
      {/* Title bar */}
      <div className="flex h-10 items-center gap-3 border-b border-white/[0.06] px-3">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-zinc-700" />
          <span className="size-2.5 rounded-full bg-zinc-700" />
          <span className="size-2.5 rounded-full bg-zinc-700" />
        </div>
        <p className="min-w-0 truncate font-mono text-xs text-zinc-500">
          cap-phep-xd <span className="text-zinc-700">/</span> <span className="text-zinc-300">SRS</span>
        </p>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-0.5 font-mono text-[11px] text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
          Synced with Jira
        </span>
      </div>

      {/* File tabs */}
      <div role="tablist" aria-label={t("a11y.openFiles")} className="flex border-b border-white/[0.06] bg-zinc-950/40">
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`relative border-r border-white/[0.06] px-4 py-2 font-mono text-xs transition-colors ${
                selected ? "bg-zinc-900/60 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.file}
              {selected && <span className="absolute inset-x-0 top-0 h-px bg-blue-500" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="grid md:grid-cols-[200px_1fr]">
        {/* Outline */}
        <aside className="hidden border-r border-white/[0.06] p-3 md:block">
          <p className="px-2 pb-2 font-mono text-[11px] uppercase tracking-wider text-zinc-600">§3.2 Functions</p>
          <ul className="space-y-0.5 text-[13px]">
            {OUTLINE.map((item) => (
              <li
                key={item.id}
                className={`flex items-center gap-2 rounded px-2 py-1.5 ${
                  item.active ? "bg-white/[0.04] text-zinc-100" : "text-zinc-500"
                }`}
              >
                <span className="font-mono text-[11px] text-zinc-600">{item.id}</span>
                <span className="truncate">{item.label}</span>
                {item.flags > 0 && (
                  <span className="ml-auto font-mono text-[10px] text-red-400">{item.flags}</span>
                )}
              </li>
            ))}
          </ul>
        </aside>

        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className="min-h-[340px] p-4 sm:p-6"
        >
          {tab === "doc" ? <DocumentPanel /> : <AuditLogPanel />}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.06] px-3 py-2 font-mono text-[11px] text-zinc-500">
        <span className="text-blue-400">CR-012</span>
        <span>{t("mockup.impacted", { count: 3 })}</span>
        <span>{t("mockup.openConflicts", { count: 1 })}</span>
        <span className="ml-auto hidden sm:inline">spine v48</span>
      </div>
    </figure>
  );
}

function DocumentPanel() {
  const t = useTranslations("landing");
  const emphasis = (chunks: ReactNode) => <span className="text-zinc-200">{chunks}</span>;

  return (
    <article className="text-sm leading-relaxed text-zinc-400">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-zinc-600">3.2.4</span>
        <h3 className="font-medium text-zinc-100">F-S04-01 · Submit permit application</h3>
      </header>

      <p className="mb-4 max-w-prose">
        The applicant uploads a dossier with design drawings and legal documents. The system checks that every
        required part is present before sending it to review.
      </p>

      {/* Diff + inline annotation cùng một hàng lưới để chú thích bám đúng dòng lỗi */}
      <div className="grid gap-3 lg:grid-cols-[1fr_240px] lg:gap-5">
        <div className="overflow-hidden rounded-md border border-white/[0.06] font-mono text-[12.5px]">
          <DiffLine kind="context" n={41}>
            Validation: the dossier must include design drawings.
          </DiffLine>
          <DiffLine kind="del" n={42}>
            Review deadline:{" "}
            <mark className="bg-transparent text-red-300 underline decoration-red-400 decoration-wavy underline-offset-4">
              5 working days
            </mark>
            .
          </DiffLine>
          <DiffLine kind="add" n={42}>
            Review deadline: at most 3 working days (NFR-02).
          </DiffLine>
          <DiffLine kind="add" n={43}>
            Buildings &gt; 7 floors: a fire-safety approval document is required.
          </DiffLine>
        </div>

        <aside
          aria-label={t("a11y.conflictNote")}
          className="relative rounded-md border border-white/[0.1] bg-zinc-900 p-3 text-[13px] before:absolute before:-top-[5px] before:left-6 before:size-2.5 before:rotate-45 before:border-l before:border-t before:border-white/[0.1] before:bg-zinc-900 lg:before:left-[-5px] lg:before:top-9 lg:before:border-b lg:before:border-r-0 lg:before:border-t-0"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-red-500/15 font-mono text-[10px] text-red-400">
              !
            </span>
            <span className="font-medium text-zinc-100">{t("mockup.conflict")}</span>
            <span className="ml-auto font-mono text-[11px] text-zinc-500">UC-07 ↔ NFR-02</span>
          </div>
          <p className="text-zinc-400">{t.rich("mockup.conflictBody", { em: emphasis })}</p>
          <div className="mt-3 flex gap-2 text-xs" aria-hidden="true">
            <span className="rounded border border-white/[0.12] bg-[#FAFAFA] px-2 py-1 font-medium text-zinc-950">
              {t("mockup.apply")}
            </span>
            <span className="rounded border border-white/[0.12] px-2 py-1 text-zinc-300">{t("mockup.askClient")}</span>
          </div>
        </aside>
      </div>

      <p className="mt-4 font-mono text-[11px] text-zinc-600">
        {t.rich("mockup.trackChanges", { cr: (chunks) => <span className="text-blue-400">{chunks}</span> })}
      </p>
    </article>
  );
}

function DiffLine({ kind, n, children }: { kind: "context" | "add" | "del"; n: number; children: ReactNode }) {
  const styles = {
    context: { row: "", sign: " ", text: "text-zinc-500" },
    del: { row: "bg-red-500/[0.08]", sign: "−", text: "text-red-300/90 line-through decoration-red-400/40" },
    add: { row: "bg-emerald-500/[0.08]", sign: "+", text: "text-emerald-300" },
  }[kind];

  return (
    <div className={`flex gap-3 px-3 py-1.5 ${styles.row}`}>
      <span className="w-5 shrink-0 select-none text-right text-zinc-600">{n}</span>
      <span className="w-3 shrink-0 select-none text-zinc-500">{styles.sign}</span>
      <span className={`min-w-0 ${styles.text}`}>{children}</span>
    </div>
  );
}

const LOG_LINES: { key: string; value: string; tone?: "ok" | "err" | "accent" }[] = [
  { key: "change_request", value: '"CR-012"', tone: "accent" },
  { key: "source", value: '"email · 10/09"' },
  { key: "impacted", value: '["F-S04-01", "UC-03", "UC-07"]' },
  { key: "untouched_sections", value: "47" },
  { key: "conflicts", value: '["UC-07 ↔ NFR-02"]', tone: "err" },
  { key: "checks_passed", value: "142", tone: "ok" },
  { key: "base_version", value: "47" },
  { key: "status", value: '"awaiting_approval"' },
];

function AuditLogPanel() {
  const toneClass = { ok: "text-emerald-400", err: "text-red-400", accent: "text-blue-400" } as const;
  return (
    <pre className="overflow-x-auto font-mono text-[12.5px] leading-6 text-zinc-500">
      <code>
        {"{\n"}
        {LOG_LINES.map((line, i) => (
          <span key={line.key}>
            {"  "}
            <span className="text-zinc-300">&quot;{line.key}&quot;</span>
            {": "}
            <span className={line.tone ? toneClass[line.tone] : "text-zinc-400"}>{line.value}</span>
            {i < LOG_LINES.length - 1 ? ",\n" : "\n"}
          </span>
        ))}
        {"}"}
      </code>
    </pre>
  );
}
