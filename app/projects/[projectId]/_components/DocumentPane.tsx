"use client";

import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SectionProgress } from "@/types/pipeline";
import type { Spine } from "@/types/spine";

interface DocumentPaneProps {
  projectName?: string;
  spine: Spine | null;
  /** Status tính ở BE (`GET /progress`); thiếu thì hiện "chưa rõ". */
  sections?: SectionProgress[];
}

/*
 * Bản TẠM (T12): FE ghép markdown từ `GET /spine` theo section FPT. T16 thay bằng `GET /document`
 * (RenderedDocument do assemble T15 dựng). Chỉ đọc — nội dung chỉ đổi qua step/chat.
 */

interface OutlineSection {
  id: string;
  number: string;
  title: string;
  build: (spine: Spine) => string;
}

const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "");
const table = (header: string[], rows: string[][]) =>
  rows.length
    ? [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, "/")).join(" | ")} |`)].join("\n")
    : "";
const nfrTable = (spine: Spine, category: string) =>
  table(
    ["ID", "Requirement", "Metric", "Threshold"],
    spine.nfrs.filter((n) => n.category === category).map((n) => [n.id, n.statement, n.metric ?? "", n.threshold ?? ""])
  );

export const DOCUMENT_OUTLINE: OutlineSection[] = [
  {
    id: "fixed:1",
    number: "1",
    title: "Product Overview",
    build: (s) =>
      [
        s.project.vision ?? "",
        list(s.project.goals),
        s.project.release_scope.in.length ? `**In scope**\n${list(s.project.release_scope.in)}` : "",
        s.project.release_scope.out.length ? `**Out of scope**\n${list(s.project.release_scope.out)}` : "",
        list(s.business_rules.filter((b) => b.tier === "high").map((b) => `${b.id}: ${b.statement}`)),
      ]
        .filter(Boolean)
        .join("\n\n"),
  },
  { id: "fixed:2.1", number: "2.1", title: "Actors", build: (s) => table(["ID", "Actor", "Kind", "Description"], s.actors.map((a) => [a.id, a.name, a.kind, a.description])) },
  {
    id: "fixed:2.2.2",
    number: "2.2.2",
    title: "Use Case Descriptions",
    build: (s) => table(["ID", "Use case", "Actors", "Description"], s.use_cases.map((u) => [u.id, u.name, u.actor_ids.join(", "), u.description])),
  },
  { id: "fixed:3.1.2", number: "3.1.2", title: "Screen Descriptions", build: (s) => table(["ID", "Screen", "Feature", "Description"], s.screens.map((x) => [x.id, x.name, x.feature_id, x.description])) },
  {
    id: "fixed:3.1.3",
    number: "3.1.3",
    title: "Screen Authorization",
    build: (s) => table(["Screen", "Role", "Action"], s.permissions.map((p) => [p.screen_id, p.role_id, p.action])),
  },
  { id: "fixed:3.1.5", number: "3.1.5", title: "Entity Relationship Diagram", build: (s) => table(["ID", "Entity", "Description"], s.entities.map((e) => [e.id, e.name, e.description])) },
  { id: "fixed:4.1", number: "4.1", title: "External Interfaces", build: (s) => nfrTable(s, "interface") },
  { id: "fixed:4.2.1", number: "4.2.1", title: "Usability", build: (s) => nfrTable(s, "usability") },
  { id: "fixed:4.2.2", number: "4.2.2", title: "Reliability", build: (s) => nfrTable(s, "reliability") },
  { id: "fixed:4.2.3", number: "4.2.3", title: "Performance", build: (s) => nfrTable(s, "performance") },
  { id: "fixed:5.1", number: "5.1", title: "Business Rules", build: (s) => list(s.business_rules.filter((b) => b.tier === "detail").map((b) => `${b.id}: ${b.statement}`)) },
  { id: "fixed:5.2", number: "5.2", title: "Common Requirements", build: (s) => list(s.common_requirements.map((c) => `${c.category}: ${c.statement}`)) },
  { id: "fixed:5.3", number: "5.3", title: "Application Messages List", build: (s) => table(["Code", "Message"], s.messages.map((m) => [m.code, m.text])) },
  { id: "fixed:5.4", number: "5.4", title: "Other Requirements", build: (s) => list(s.other_requirements.map((o) => `(${o.kind}) ${o.statement}`)) },
  { id: "fixed:5.5", number: "5.5", title: "Glossary", build: (s) => table(["Term", "Definition"], s.glossary.map((g) => [g.term, g.definition])) },
];

const STATUS_BADGE: Record<SectionProgress["status"], { text: string; style: string }> = {
  accepted: { text: "Accepted", style: "bg-[#E9F7EE] text-[#1F7A45]" },
  draft: { text: "Draft", style: "bg-[#F4F3FE] text-[#3B34B0]" },
  stale: { text: "Cũ", style: "bg-[#FBF4E4] text-[#8A6D1F]" },
  derived: { text: "Dẫn xuất", style: "bg-[#F0EEEA] text-[#6B6862]" },
};

export const buildDocumentMarkdown = (projectName: string, spine: Spine): string =>
  [
    `# Software Requirement Specification — ${projectName}`,
    ...DOCUMENT_OUTLINE.map((section) => `## ${section.number} ${section.title}\n\n${section.build(spine) || "_Chưa có nội dung._"}`),
  ].join("\n\n");

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="w-full border-collapse text-[11.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-[#ECEAE5] bg-[#FAF9F7] px-2 py-1 text-left font-bold">{children}</th>,
  td: ({ children }) => <td className="border border-[#ECEAE5] px-2 py-1 align-top">{children}</td>,
  h1: ({ children }) => <h1 className="text-[15px] font-extrabold mt-3 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-[14px] font-extrabold mt-3 mb-2">{children}</h2>,
};

const Markdown = ({ content }: { content: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
    {content}
  </ReactMarkdown>
);

/** Document pane chỉ đọc: SRS ghép từ Spine; nội dung chỉ đổi qua step/chat (Phases §2.3). */
export default function DocumentPane({ projectName = "Dự án", spine, sections = [] }: DocumentPaneProps) {
  const [showFull, setShowFull] = useState(false);
  const statusOf = (id: string) => sections.find((s) => s.id === id);

  return (
    <section className="flex-1 bg-white flex flex-col min-w-[320px] overflow-hidden">
      <div className="px-6 py-3 border-b border-[#ECEAE5] flex items-center justify-between shrink-0 h-[52px] bg-white">
        <div className="flex items-center gap-2.5">
          <h3 className="font-extrabold text-[13.5px] text-[#191817]">SRS — {projectName}</h3>
          {spine && <span className="text-[10.5px] text-[#8A867E] bg-[#F5F3F0] px-2 py-0.5 rounded-full font-mono">v{spine.spine_version}</span>}
        </div>
        <button
          type="button"
          disabled={!spine}
          onClick={() => setShowFull(true)}
          className="px-3 py-1 rounded-full bg-[#FAF9F7] hover:bg-[#F4F3FE] border border-[#ECEAE5] text-[#4F46E5] text-[11.5px] font-bold cursor-pointer disabled:opacity-50"
        >
          📄 Xem toàn văn SRS
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#FAF9F7]">
        {!spine && <div className="text-[12px] text-[#A8A49C] italic">Đang tải Spine…</div>}
        {spine &&
          DOCUMENT_OUTLINE.map((section) => {
            const content = section.build(spine);
            const status = statusOf(section.id);
            const badge = status ? STATUS_BADGE[status.status] : null;
            return (
              <article key={section.id} className="p-4 rounded-[12px] border border-[#ECEAE5] bg-white flex flex-col gap-2" data-section-id={section.id}>
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-[12.5px] text-[#191817]">
                    §{section.number} {section.title}
                  </h5>
                  <div className="flex items-center gap-1.5">
                    {status?.awaiting_reaccept && <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-[#FBF4E4] text-[#8A6D1F]">Chờ duyệt lại</span>}
                    {badge && <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${badge.style}`}>{badge.text}</span>}
                  </div>
                </div>
                {content ? (
                  <div className="text-[12px] text-[#33312D] leading-relaxed">
                    <Markdown content={content} />
                  </div>
                ) : (
                  <div className="text-[11.5px] text-[#A8A49C] italic">Chưa hoàn thiện — nội dung sẽ có khi step sở hữu section chạy.</div>
                )}
              </article>
            );
          })}
      </div>

      {showFull && spine && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[20px] p-6 max-w-4xl w-full h-[85vh] border border-[#ECEAE5] shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECEAE5]">
              <h3 className="font-extrabold text-[16px] text-[#191817]">Toàn văn tài liệu SRS — {projectName}</h3>
              <button type="button" onClick={() => setShowFull(false)} className="p-1.5 hover:bg-[#F5F3F0] rounded-full text-[#8A867E] cursor-pointer">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-[#FAF9F7] rounded-[12px] border border-[#ECEAE5] text-[12.5px] leading-relaxed">
              <Markdown content={buildDocumentMarkdown(projectName, spine)} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
