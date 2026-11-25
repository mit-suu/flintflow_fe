"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { FoundGroup, ImportSourceBlock } from "@/types/import";

/** Trạng thái hiển thị của một mục: AI đang đọc · đã xong · lỗi · chưa tới. */
export type SectionView = "reading" | "done" | "failed" | "todo";

/** Một mục của khung tài liệu — dữ liệu phẳng để thẻ mục `memo` được (poll 2 giây không dựng lại hàng trăm mục). */
export interface PaneSection {
  id: string;
  title: string;
  state: SectionView;
  error: string | null;
  found: FoundGroup[];
  /** Chữ ký của `found` (so sánh nhanh thay cho so sâu). */
  foundSig: string;
  /** Chữ gốc của mục; `null` = chưa tải xong (hiện dòng giả như trước). */
  blocks: ImportSourceBlock[] | null;
}

export const foundSignature = (found: readonly FoundGroup[]): string => found.map((g) => `${g.entity}:${g.count}:${g.names.join("\u0001")}`).join("\u0002");

const MAX_FOUND_NAMES = 3;
const TABLE_PREVIEW_ROWS = 6;
/** Vào nhanh rồi chậm dần; ra nhanh hơn vào. */
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
/** Nạp thân mục khi tới gần khung nhìn ngần này (px) — cuộn tới đâu có chữ tới đó, không dựng cả 200 trang một lượt. */
const NEAR_VIEWPORT_MARGIN = "1500px 0px";
const LINE_HEIGHT_PX = 22;
const CHARS_PER_LINE = 100;

/** Thứ tự loại trong dòng tổng: phần tử chính của SRS trước, sơ đồ cuối. */
const TOTALS_ORDER = ["actors", "use_cases", "functions", "screens", "entities", "business_rules", "nfrs", "glossary", "features", "roles", "permissions", "messages", "diagram"];

/** Nhãn loại phần tử dùng chung với nhật ký hoạt động (`workspace.activityLog.collections`); loại lạ ⇒ tên khoá bỏ gạch dưới. */
function useFoundLabels() {
  const t = useTranslations("workspace.import.progress");
  const tc = useTranslations("workspace.activityLog.collections");
  return useMemo(() => {
    const entity = (key: string): string => (key === "diagram" ? t("foundDiagram") : tc.has(key as "actors") ? tc(key as "actors") : key.replace(/_/g, " "));
    const name = (key: string, value: string): string => {
      if (key !== "diagram") return value;
      const path = `diagramKinds.${value}` as "diagramKinds.erd";
      return t.has(path) ? t(path) : value;
    };
    return { entity, name, more: (count: number) => t("foundMore", { count }), line: (label: string, names: string) => t("foundLine", { label, names }) };
  }, [t, tc]);
}

/** Số tăng dần (~400ms). Rộng cố định theo số chữ số của đích + tabular-nums ⇒ chữ xung quanh không nhảy khi số chạy. */
function CountUp({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  useEffect(() => {
    const controls = animate(shownRef.current, value, {
      duration: reduced ? 0 : 0.4,
      ease: "easeOut",
      onUpdate: (v) => {
        shownRef.current = v;
        setShown(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, reduced]);
  return (
    <span className="inline-block text-right tabular-nums" style={{ minWidth: `${String(value).length}ch` }}>
      {shown}
    </span>
  );
}

/** `Đã tìm thấy: 8 actor · 23 use case · …` — cộng số lượng của mọi mục. Chừa sẵn một dòng để lúc có số đầu tiên không đẩy trang. */
export function FoundTotals({ sections }: { sections: readonly { found: readonly FoundGroup[] }[] }) {
  const t = useTranslations("workspace.import.progress");
  const labels = useFoundLabels();
  const totals = useMemo(() => {
    const sum = new Map<string, number>();
    for (const s of sections) for (const g of s.found) sum.set(g.entity, (sum.get(g.entity) ?? 0) + g.count);
    const rank = (k: string) => (TOTALS_ORDER.includes(k) ? TOTALS_ORDER.indexOf(k) : TOTALS_ORDER.length);
    return [...sum.entries()].filter(([, n]) => n > 0).sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [sections]);
  return (
    <p className="min-h-5 flex flex-wrap items-baseline gap-x-1 text-body text-on-surface-variant">
      {totals.length > 0 && (
        <>
          <span>{t("foundTotal")}</span>
          {totals.map(([entity, count], i) => (
            <span key={entity} className="inline-flex items-baseline gap-1">
              {i > 0 && <span aria-hidden className="text-on-surface-muted">{t("foundSeparator").trim()}</span>}
              <span className="font-medium text-on-surface">
                <CountUp value={count} />
              </span>
              <span>{labels.entity(entity)}</span>
            </span>
          ))}
        </>
      )}
    </p>
  );
}

/** Dòng "tìm thấy" dưới một mục: tối đa 3 tên rồi "và N mục khác"; dòng mới vào trượt nhẹ, dòng bỏ đi ra nhanh hơn. */
function FoundLines({ found }: { found: readonly FoundGroup[] }) {
  const labels = useFoundLabels();
  const reduced = useReducedMotion();
  if (found.length === 0) return null;
  return (
    <ul className="flex flex-col gap-0.5 text-caption text-on-surface-variant">
      <AnimatePresence initial={false}>
        {found.map((g, i) => {
          const shown = g.names.slice(0, MAX_FOUND_NAMES).map((n) => labels.name(g.entity, n));
          const rest = g.count - shown.length;
          const names = rest > 0 ? `${shown.join(", ")} ${labels.more(rest)}` : shown.join(", ");
          return (
            <motion.li
              key={g.entity}
              className="min-w-0 break-words"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT, delay: reduced ? 0 : i * 0.04 } }}
              exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.14, ease: "easeIn" } }}
            >
              {names ? labels.line(labels.entity(g.entity), names) : `+ ${labels.entity(g.entity)}`}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

/** Bảng dạng gọn: `| a | b |` mỗi dòng; chỉ vài dòng đầu. Chữ của khách giữ nguyên. */
function TableBlock({ text }: { text: string }) {
  const t = useTranslations("workspace.import.progress");
  const rows = text.split("\n").filter((r) => r.trim());
  const cells = (row: string) => row.trim().replace(/^\|\s*/, "").replace(/\s*\|$/, "").split(/\s*\|\s*/);
  const shown = rows.slice(0, TABLE_PREVIEW_ROWS);
  return (
    <div className="overflow-x-auto ff-scroll">
      <table className="w-full text-caption text-on-surface-variant">
        <tbody>
          {shown.map((row, r) => (
            <tr key={r} className={r === 0 ? "font-semibold text-on-surface" : ""}>
              {cells(row).map((cell, c) => (
                <td key={c} className="bg-surface-container-low px-2 py-1 align-top break-words">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && <p className="pt-1 text-caption text-on-surface-muted">{t("tableMoreRows", { count: rows.length - shown.length })}</p>}
    </div>
  );
}

function BlockView({ block }: { block: ImportSourceBlock }) {
  const t = useTranslations("workspace.import.progress");
  switch (block.kind) {
    case "image":
      return (
        <div aria-hidden className="h-10 w-28 rounded-inner bg-surface-container flex items-center justify-center text-caption text-on-surface-muted">
          {t("figure")}
        </div>
      );
    case "table":
      return <TableBlock text={block.text} />;
    case "list_item":
      return (
        <p className="relative pl-4 text-body text-on-surface-variant leading-relaxed whitespace-pre-wrap break-words">
          <span aria-hidden className="absolute left-0.5">
            •
          </span>
          {block.text}
        </p>
      );
    case "caption":
      return <p className="text-caption italic text-on-surface-muted whitespace-pre-wrap break-words">{block.text}</p>;
    default:
      return block.text.trim() ? <p className="text-body text-on-surface-variant leading-relaxed whitespace-pre-wrap break-words">{block.text}</p> : null;
  }
}

/** Ước chiều cao thân mục (px) từ số chữ — chỗ giữ trước khi thân được dựng, để thanh cuộn không giật khi nội dung hiện ra. */
const estimateHeight = (blocks: readonly ImportSourceBlock[]): number =>
  blocks.reduce((sum, b) => sum + (b.kind === "image" ? 48 : b.kind === "table" ? 24 * Math.min(b.text.split("\n").length, TABLE_PREVIEW_ROWS + 1) : Math.max(1, Math.ceil(b.text.length / CHARS_PER_LINE)) * LINE_HEIGHT_PX) + 8, 0);

/** Chỉ dựng thân mục khi nó tới gần khung nhìn (hoặc đang đọc); dựng rồi thì giữ. */
function useNearViewport(root: HTMLElement | null, forced: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !root || near) return;
    // Môi trường không có observer (jsdom, trình duyệt rất cũ): dựng ngay, không treo ở chỗ giữ trước
    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setNear(true));
      return;
    }
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { root, rootMargin: NEAR_VIEWPORT_MARGIN });
    observer.observe(el);
    return () => observer.disconnect();
  }, [root, near]);
  return { ref, ready: near || forced };
}

const STATE_PILL: Record<SectionView, string> = {
  reading: "bg-primary-soft text-primary",
  done: "bg-success-soft text-success",
  failed: "bg-error-container text-on-error-container",
  todo: "bg-surface-container text-on-surface-muted",
};

interface SectionCardProps extends PaneSection {
  scrollRoot: HTMLElement | null;
}

const sameCard = (a: SectionCardProps, b: SectionCardProps) =>
  a.id === b.id && a.title === b.title && a.state === b.state && a.error === b.error && a.foundSig === b.foundSig && a.blocks === b.blocks && a.scrollRoot === b.scrollRoot;

/**
 * Một mục của tài liệu: tiêu đề + chữ gốc + thứ AI tìm thấy. Đang đọc ⇒ nền nhạt + dải quét; vừa xong ⇒ nháy một nhịp;
 * lỗi ⇒ nền báo lỗi. `content-visibility: auto` bỏ qua dựng hình phần ngoài khung nhìn.
 */
const SectionCard = memo(function SectionCard({ id, title, state, error, found, blocks, scrollRoot }: SectionCardProps) {
  const t = useTranslations("workspace.import.progress");
  const { ref, ready } = useNearViewport(scrollRoot, state === "reading");
  // Vừa chuyển sang xong trong lúc đang xem ⇒ nháy một nhịp rồi gỡ (không nháy cho mục đã xong từ trước)
  const [prevState, setPrevState] = useState(state);
  const [flash, setFlash] = useState(false);
  if (prevState !== state) {
    setPrevState(state);
    setFlash(state === "done");
  }
  const estimated = useMemo(() => (blocks ? estimateHeight(blocks) : 56), [blocks]);
  const reading = state === "reading";
  return (
    <li
      data-section-id={id}
      aria-current={reading ? "true" : undefined}
      onAnimationEnd={(e) => e.target === e.currentTarget && e.animationName === "ff-flash" && setFlash(false)}
      style={{ contentVisibility: "auto", containIntrinsicSize: `auto ${estimated + 72}px` }}
      className={`flex flex-col gap-2 rounded-inner px-3 py-3 transition-colors duration-300 ${reading ? "ff-read-sweep bg-primary-soft" : state === "failed" ? "bg-error-container/40" : ""} ${flash ? "ff-flash" : ""}`.trim()}
    >
      <div className="flex items-start gap-3">
        <span className="size-4 mt-[3px] shrink-0 flex items-center justify-center">
          {state === "done" ? (
            <Icon name="check-circle" size={15} className="text-success" />
          ) : state === "failed" ? (
            <Icon name="error-circle" size={15} className="text-on-error-container" />
          ) : reading ? (
            <Icon name="spinner" size={15} className="text-primary animate-spin motion-reduce:animate-none" />
          ) : (
            <span className="size-1.5 rounded-full bg-on-surface/20" />
          )}
        </span>
        <span className={`flex-1 min-w-0 text-body font-semibold break-words ${state === "todo" ? "text-on-surface-muted" : "text-on-surface"}`}>{title}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-medium ${STATE_PILL[state]}`}>{t(`row.${state === "reading" ? "active" : state}`)}</span>
      </div>
      <div ref={ref} className="pl-7 flex flex-col gap-1.5" style={ready ? undefined : { minHeight: estimated }}>
        {blocks === null ? (
          // Chữ gốc chưa về: dòng giả như trước
          <span aria-hidden className="flex flex-col gap-1">
            <span className="h-1.5 w-11/12 rounded-full bg-on-surface/[0.06]" />
            <span className="h-1.5 w-3/5 rounded-full bg-on-surface/[0.06]" />
          </span>
        ) : (
          ready && blocks.map((b) => <BlockView key={b.block_id} block={b} />)
        )}
      </div>
      {state === "failed" && error && <p className="pl-7 text-caption text-on-error-container break-words">{error}</p>}
      {found.length > 0 && (
        <div className="pl-7">
          <FoundLines found={found} />
        </div>
      )}
    </li>
  );
}, sameCard);

interface ImportSourcePaneProps {
  sections: readonly PaneSection[];
  scrollRoot: HTMLElement | null;
}

/** Danh sách mục của khung tài liệu (nằm trong vùng cuộn do nơi gọi giữ). */
export function ImportSourcePane({ sections, scrollRoot }: ImportSourcePaneProps) {
  return (
    <ol className="flex flex-col gap-0.5">
      {sections.map((s) => (
        <SectionCard key={s.id} {...s} scrollRoot={scrollRoot} />
      ))}
    </ol>
  );
}

interface OutlineRowProps {
  id: string;
  title: string;
  state: SectionView;
  onJump: (id: string) => void;
}

const OutlineRow = memo(function OutlineRow({ id, title, state, onJump }: OutlineRowProps) {
  const t = useTranslations("workspace.import.progress");
  return (
    <li>
      <button
        type="button"
        onClick={() => onJump(id)}
        aria-label={t("outlineJump", { title })}
        className={`w-full min-h-8 flex items-center gap-2 rounded-inner px-2 text-left text-body cursor-pointer transition-colors duration-150 hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${state === "reading" ? "bg-primary-soft text-on-surface" : state === "todo" ? "text-on-surface-muted" : "text-on-surface-variant"}`}
      >
        <span className="size-4 shrink-0 flex items-center justify-center">
          {state === "done" ? (
            <Icon name="check" size={13} className="text-success" />
          ) : state === "failed" ? (
            <Icon name="warning" size={13} className="text-on-error-container" />
          ) : state === "reading" ? (
            <Icon name="spinner" size={12} className="text-primary animate-spin motion-reduce:animate-none" />
          ) : (
            <span className="size-1.5 rounded-full bg-on-surface/20" />
          )}
        </span>
        <span className="min-w-0 truncate" title={title}>
          {title}
        </span>
      </button>
    </li>
  );
});

/** Danh sách mục gọn ở cột bên: bấm một dòng ⇒ khung tài liệu nhảy tới mục đó. */
export function SectionOutline({ sections, onJump }: { sections: readonly PaneSection[]; onJump: (id: string) => void }) {
  const t = useTranslations("workspace.import.progress");
  return (
    <nav aria-label={t("outlineLabel")} className="rounded-control bg-surface-container-lowest p-1.5">
      <ul className="flex flex-col max-h-72 overflow-y-auto ff-scroll">
        {sections.map((s) => (
          <OutlineRow key={s.id} id={s.id} title={s.title} state={s.state} onJump={onJump} />
        ))}
      </ul>
    </nav>
  );
}
