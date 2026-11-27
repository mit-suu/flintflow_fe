"use client";

import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import type { Block, InlineRun, TableCell } from "@/types/document";
import type { CrDocumentDiff, CrLocation, DocChange, DocDiffBlock, DocDiffItem, DocDiffRow, DocDiffSection } from "@/types/change-request";
import { useCrDocumentDiff } from "../../hooks/mode1/useCrDocumentDiff";
import { BlockView, Runs, depthOf, followsHeading, headingSize } from "../DocumentPane";
import { diffWords } from "./word-diff";
import { useLocTitle } from "./LocationDisplay";
import { needsOwnCard } from "./Mode1CrThread";

/**
 * FLF-495: chế độ "Xem CR trên tài liệu" - đề xuất của CR tô thẳng lên tài liệu (xoá đỏ gạch ngang, thêm xanh lá, sửa tô chữ đổi;
 * dòng bảng / mục danh sách xoá hoặc thêm tô cả dòng). Chỉ đọc, dữ liệu từ `GET …/document-diff` (BE dựng khô, không tốn credit).
 * Phẳng, không viền: phân tách bằng nền như `VersionDiffView`.
 */

export interface CrDocFocus {
  locationId: string;
  /** Mỗi lần bấm một số mới, để bấm lại cùng vị trí vẫn cuộn + nháy lại. */
  nonce: number;
}

/**
 * Quyết định ngay trên tài liệu: Đồng ý / Bỏ từng đề xuất cạnh chỗ nó đổi (cùng thao tác với dòng trong khung chat). Phần phải quyết
 * riêng (trượt kiểm, hình gốc, cảnh báo…) không hiện nút ở đây - vẫn quyết ở thẻ riêng trong chat.
 */
export interface CrDocDecide {
  locations: readonly CrLocation[];
  isAccepted: (loc: CrLocation) => boolean;
  busy: boolean;
  onAccept: (loc: CrLocation) => void;
  onReject: (loc: CrLocation) => void;
}

interface DecideCtx {
  decide: CrDocDecide;
  /** Khoá phần tử (block / dòng / mục / mục lớn) -> các vị trí hiện nút quyết ngay trước phần tử đó. */
  anchors: ReadonlyMap<string, readonly string[]>;
}
const DecideContext = createContext<DecideCtx | null>(null);

const blockKey = (si: number, bi: number) => `s${si}b${bi}`;
const rowKey = (si: number, bi: number, ri: number) => `s${si}b${bi}r${ri}`;
const itemKey = (si: number, bi: number, ii: number) => `s${si}b${bi}i${ii}`;
const sectionKey = (si: number) => `s${si}`;

/** Mỗi vị trí hiện nút một lần, ở phần tử đầu tiên mang `location_id` đó; không có phần tử riêng thì ở đầu mục chứa nó. */
const buildAnchors = (diff: CrDocumentDiff | null): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  if (!diff) return map;
  const seen = new Set<string>();
  const put = (key: string, id: string | undefined) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    map.set(key, [...(map.get(key) ?? []), id]);
  };
  diff.sections.forEach((sec, si) => {
    sec.blocks.forEach((b, bi) => {
      put(blockKey(si, bi), b.location_id);
      b.rows?.forEach((r, ri) => put(rowKey(si, bi, ri), r.location_id));
      b.items?.forEach((it, ii) => put(itemKey(si, bi, ii), it.location_id));
    });
  });
  diff.sections.forEach((sec, si) => sec.location_ids.forEach((id) => put(sectionKey(si), id)));
  return map;
};

function DecisionButtons({ loc, decide }: { loc: CrLocation; decide: CrDocDecide }) {
  const tLoc = useTranslations("mode1.crThread.loc");
  const t = useTranslations("mode1.crThread.batch");
  const title = useLocTitle()(loc);
  if (decide.isAccepted(loc)) {
    return <span className="px-2 py-0.5 rounded-full text-caption font-bold bg-success-soft text-success">{tLoc("accepted")}</span>;
  }
  const btn = "h-7 px-3 rounded-control text-caption font-bold disabled:opacity-50 cursor-pointer";
  return (
    <>
      <button type="button" disabled={decide.busy} onClick={() => decide.onAccept(loc)} aria-label={t("acceptRow", { title })} className={`${btn} bg-success text-white`}>
        {tLoc("accept")}
      </button>
      <button type="button" disabled={decide.busy} onClick={() => decide.onReject(loc)} aria-label={t("rejectRow", { title })} className={`${btn} bg-error-container text-error`}>
        {tLoc("reject")}
      </button>
    </>
  );
}

/** Thanh Đồng ý / Bỏ đặt ngay trước chỗ đổi. `as` chọn thẻ bọc cho hợp ngữ cảnh (bảng, danh sách, văn bản). */
function Decision({ at, as = "div", span = 1 }: { at: string; as?: "div" | "tr" | "li"; span?: number }) {
  const ctx = useContext(DecideContext);
  const ids = ctx?.anchors.get(at);
  if (!ctx || !ids) return null;
  const bars = ids
    .map((id) => ctx.decide.locations.find((l) => l.location_id === id))
    .filter((l): l is CrLocation => !!l && l.conclusion === "edit" && !!l.proposal && !needsOwnCard(l));
  if (bars.length === 0) return null;
  const inner = bars.map((l) => (
    <div key={l.location_id} data-testid="cr-doc-decision" className="flex items-center justify-end gap-1.5 py-0.5">
      <DecisionButtons loc={l} decide={ctx.decide} />
    </div>
  ));
  if (as === "tr") {
    return (
      <tr>
        <td colSpan={span} className="px-2">
          {inner}
        </td>
      </tr>
    );
  }
  if (as === "li") return <li className="list-none">{inner}</li>;
  return <>{inner}</>;
}

interface CrDocumentDiffViewProps {
  projectId: string;
  crId: string;
  /** Đổi khi đề xuất của CR đổi ⇒ tải lại. */
  refreshKey?: string;
  focus: CrDocFocus | null;
  onExit: () => void;
  /** Có ⇒ tiêu đề đếm theo số đề xuất (cùng đơn vị với khung chat) thay vì số mục / chỗ đổi nhỏ. */
  proposalCount?: number;
  /** Có ⇒ hiện Đồng ý / Bỏ từng đề xuất ngay trên tài liệu. */
  decide?: CrDocDecide;
}

/** Khoá tải lại: đổi khi kết luận / đề xuất của bất kỳ vị trí nào đổi (Sửa lại, Bỏ, AI soạn lại). */
export const crProposalsKey = (locations: readonly Pick<CrLocation, "location_id" | "conclusion" | "proposal">[]): string => {
  const text = JSON.stringify(locations.map((l) => [l.location_id, l.conclusion, l.proposal?.spine_ops ?? []]));
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${locations.length}:${(h >>> 0).toString(36)}`;
};

/** Mỗi cấp mục con thụt vào bấy nhiêu px - cùng `DocumentPane`. */
const INDENT_PER_LEVEL = 20;
const FLASH_MS = 1600;

const BOX: Record<Exclude<DocChange, "unchanged" | "modified" | "moved">, string> = {
  added: "bg-success-soft rounded-control px-2 py-1",
  removed: "bg-error-container text-error line-through rounded-control px-2 py-1",
};

const ROW_TINT: Record<DocChange, string> = {
  unchanged: "",
  moved: "",
  added: "bg-success-soft",
  removed: "bg-error-container text-error line-through",
  modified: "",
};

const FLASH = "data-[flash=true]:ring-2 data-[flash=true]:ring-primary motion-safe:transition-shadow";

const runsText = (runs: readonly InlineRun[]): string => runs.map((r) => r.text).join("");
const cellText = (cell: TableCell): string => runsText(cell);

const point = (change: DocChange, locationId?: string) => ({
  "data-location-id": locationId,
  "data-cr-point": change !== "unchanged" && change !== "moved" ? "" : undefined,
  "data-cr-change": change === "unchanged" || change === "moved" ? undefined : change,
});

/** Chữ của đoạn sửa: chỗ xoá gạch đỏ, chỗ thêm xanh lá, phần giữ nguyên để nguyên (cùng màu với `VersionDiffView`). */
function WordDiff({ before, after }: { before: string; after: string }) {
  return (
    <>
      {diffWords(before, after).map((p, i) =>
        p.op === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.op === "del" ? (
          <del key={i} className="bg-error-container text-error rounded-sm">
            {p.text}
          </del>
        ) : (
          <ins key={i} className="bg-success-soft text-success no-underline rounded-sm">
            {p.text}
          </ins>
        ),
      )}
    </>
  );
}

function TextBlock({ item, projectId, afterHeading, ak }: { item: DocDiffBlock; projectId: string; afterHeading: boolean; ak: string }) {
  return (
    <>
      <Decision at={ak} />
      <TextBlockBody item={item} projectId={projectId} afterHeading={afterHeading} />
    </>
  );
}

function TextBlockBody({ item, projectId, afterHeading }: { item: DocDiffBlock; projectId: string; afterHeading: boolean }) {
  const { block, change } = item;
  const attrs = point(change, item.location_id);
  if (change === "modified" && item.before !== undefined && (block.type === "paragraph" || block.type === "heading")) {
    return (
      <div {...attrs} className={`${FLASH} rounded-control bg-surface-container px-2 py-1`}>
        <p className={block.type === "heading" ? "font-extrabold text-on-surface text-body" : "text-body text-on-surface-dark leading-[1.65]"}>
          <WordDiff before={item.before} after={block.type === "paragraph" ? runsText(block.runs) : block.text} />
        </p>
      </div>
    );
  }
  if (change === "added" || change === "removed") {
    return (
      <div {...attrs} className={`${FLASH} ${BOX[change]}`}>
        <BlockView block={block} projectId={projectId} afterHeading={afterHeading} />
      </div>
    );
  }
  return (
    <div {...attrs} className={FLASH}>
      <BlockView block={block} projectId={projectId} afterHeading={afterHeading} />
    </div>
  );
}

function CellContent({ row, ci }: { row: DocDiffRow; ci: number }) {
  const cell = row.cells[ci] ?? [];
  if (row.change === "modified" && row.cells_changed?.includes(ci) && row.before) {
    return (
      <span className="bg-accent-gold-soft rounded-sm">
        <WordDiff before={row.before[ci] ?? ""} after={cellText(cell)} />
      </span>
    );
  }
  return <Runs runs={cell} />;
}

function TableBlock({ item, si, bi }: { item: DocDiffBlock; si: number; bi: number }) {
  const block = item.block as Extract<Block, { type: "table" }>;
  const rows = item.rows ?? block.rows.map((cells): DocDiffRow => ({ cells, change: "unchanged" }));
  return (
    <div className="ff-scroll overflow-x-auto mb-2 mt-2">
      <Decision at={blockKey(si, bi)} />
      <table className="w-full border-collapse text-body">
        <thead>
          <tr {...(item.header_before ? point("modified") : {})} className={FLASH}>
            {block.header.map((cell, i) => (
              <th key={i} className="border border-outline bg-surface-container-low px-2 py-1 text-left font-bold">
                {item.header_before && item.header_before[i] !== cellText(cell) ? <WordDiff before={item.header_before[i] ?? ""} after={cellText(cell)} /> : <Runs runs={cell} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <Fragment key={ri}>
              <Decision at={rowKey(si, bi, ri)} as="tr" span={Math.max(row.cells.length, 1)} />
              <tr {...point(row.change, row.location_id)} className={`${FLASH} ${ROW_TINT[row.change]}`}>
                {row.cells.map((_, ci) => (
                  <td key={ci} className="border border-outline px-2 py-1 align-top">
                    <CellContent row={row} ci={ci} />
                  </td>
                ))}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListItem({ item }: { item: DocDiffItem }) {
  return (
    <li {...point(item.change, item.location_id)} className={`${FLASH} ${ROW_TINT[item.change]}`}>
      {item.change === "modified" && item.before !== undefined ? <WordDiff before={item.before} after={runsText(item.runs)} /> : <Runs runs={item.runs} />}
    </li>
  );
}

function ListBlock({ item, si, bi }: { item: DocDiffBlock; si: number; bi: number }) {
  const block = item.block as Extract<Block, { type: "bullet_list" | "numbered_list" }>;
  const items = item.items ?? block.items.map((runs): DocDiffItem => ({ runs, change: "unchanged" }));
  const Tag = block.type === "bullet_list" ? "ul" : "ol";
  return (
    <Tag className={`${block.type === "bullet_list" ? "list-disc" : "list-decimal"} pl-5 mb-2 space-y-1 text-body leading-[1.65] text-on-surface-dark`}>
      <Decision at={blockKey(si, bi)} as="li" />
      {items.map((it, i) => (
        <Fragment key={i}>
          <Decision at={itemKey(si, bi, i)} as="li" />
          <ListItem item={it} />
        </Fragment>
      ))}
    </Tag>
  );
}

function SectionBlock({ section, projectId, si }: { section: DocDiffSection; projectId: string; si: number }) {
  const t = useTranslations("mode1.crDocView");
  const depth = depthOf({ level: section.level, number: section.number } as Parameters<typeof depthOf>[0]);
  const blocks = section.blocks;
  return (
    <article
      data-cr-section-id={section.id}
      data-cr-locations={section.location_ids.join(" ")}
      style={{ marginLeft: depth * INDENT_PER_LEVEL - 12 }}
      className={`${FLASH} -mr-3 px-3 py-1.5 rounded-control flex flex-col gap-1.5`}
    >
      <Decision at={sectionKey(si)} />
      <div className="flex items-baseline gap-2 flex-wrap">
        <h5
          {...(section.heading_before ? point("modified") : {})}
          className={`${FLASH} font-bold text-on-surface ${headingSize(depth)} ${section.change === "removed" ? "line-through text-error" : ""}`}
        >
          {section.number ? `${section.number}. ` : ""}
          {section.heading_before ? <WordDiff before={section.heading_before} after={section.heading} /> : section.heading}
        </h5>
        {section.change !== "modified" && (
          <span className={`text-caption font-extrabold px-2 py-0.5 rounded-full ${section.change === "added" ? "bg-success-soft text-success" : "bg-error-container text-error"}`}>
            {t(section.change === "added" ? "sectionAdded" : "sectionRemoved")}
          </span>
        )}
      </div>
      {blocks.map((item, i) => {
        if (item.block.type === "table") return <TableBlock key={i} item={item} si={si} bi={i} />;
        if (item.block.type === "bullet_list" || item.block.type === "numbered_list") return <ListBlock key={i} item={item} si={si} bi={i} />;
        return <TextBlock key={i} item={item} projectId={projectId} afterHeading={followsHeading(blocks.map((b) => b.block), i)} ak={blockKey(si, i)} />;
      })}
    </article>
  );
}

/** Cuộn tới phần tử và nháy viền một lần; người bật giảm chuyển động thì nhảy thẳng, viền đứng yên. */
const reveal = (el: HTMLElement): void => {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView?.({ block: "center", behavior: reduced ? "auto" : "smooth" });
  el.dataset.flash = "true";
  window.setTimeout(() => {
    delete el.dataset.flash;
  }, FLASH_MS);
};

export default function CrDocumentDiffView({ projectId, crId, refreshKey = "", focus, onExit, decide, proposalCount }: CrDocumentDiffViewProps) {
  const t = useTranslations("mode1.crDocView");
  const { diff, loading, error } = useCrDocumentDiff(projectId, crId, true, refreshKey);
  const rootRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(-1);
  const handled = useRef(0);

  const points = useCallback((): HTMLElement[] => Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-cr-point]") ?? []), []);

  const step = (delta: 1 | -1) => {
    const all = points();
    if (all.length === 0) return;
    let next = (current + delta + all.length) % all.length;
    if (current < 0) {
      // Chưa đi qua điểm nào (vừa mở / tự cuộn): đi theo vị trí đang đọc - điểm đầu tiên dưới (hoặc cuối cùng trên) giữa khung cuộn
      const box = rootRef.current?.parentElement?.getBoundingClientRect();
      const mid = box ? box.top + box.height / 2 : 0;
      const found = delta === 1 ? all.findIndex((el) => el.getBoundingClientRect().top > mid + 4) : all.findLastIndex((el) => el.getBoundingClientRect().top < mid - 4);
      if (found >= 0) next = found;
    }
    setCurrent(next);
    reveal(all[next]);
  };

  // Chat ⇒ tài liệu: bấm một đề xuất ⇒ cuộn tới đúng chỗ. Không có block / dòng riêng thì về mục chứa vị trí đó.
  useEffect(() => {
    // Đang tải lại (đề xuất vừa đổi) ⇒ chờ bản mới: bản cũ có thể không còn chỗ đó, và nonce chưa được tính là đã xử lý
    if (!focus || !diff || loading || focus.nonce === handled.current) return;
    const root = rootRef.current;
    if (!root) return;
    const id = CSS.escape(focus.locationId);
    const own = root.querySelector<HTMLElement>(`[data-location-id="${id}"]`);
    const target = own ?? Array.from(root.querySelectorAll<HTMLElement>("[data-cr-locations]")).find((el) => el.dataset.crLocations?.split(" ").includes(focus.locationId));
    if (!target) return;
    handled.current = focus.nonce;
    const all = points();
    setCurrent(own ? all.indexOf(own) : -1);
    reveal(target);
  }, [focus, diff, loading, points]);

  const count = diff?.change_count ?? 0;
  const anchors = useMemo(() => buildAnchors(diff), [diff]);
  const decideCtx = useMemo<DecideCtx | null>(() => (decide ? { decide, anchors } : null), [decide, anchors]);
  return (
    <DecideContext.Provider value={decideCtx}>
    <div ref={rootRef} data-testid="cr-document-diff" className="flex flex-col gap-1.5">
      <div className="sticky top-0 z-10 -mx-8 px-8 py-2 flex items-center gap-2 flex-wrap bg-primary-soft text-on-surface">
        <Icon name="file" size={14} className="text-primary" />
        <span className="text-body font-bold" aria-live="polite">
          {loading && !diff ? t("loading") : proposalCount !== undefined ? t("titleProposals", { crId, count: proposalCount }) : t("title", { crId, sections: diff?.sections.length ?? 0, count })}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={count === 0}
          className="h-7 px-2 inline-flex items-center gap-1 rounded-control text-caption font-bold text-primary hover:bg-surface-container-lowest disabled:opacity-40 disabled:cursor-default cursor-pointer"
        >
          <Icon name="chevron-up" size={13} />
          {t("prev")}
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={count === 0}
          className="h-7 px-2 inline-flex items-center gap-1 rounded-control text-caption font-bold text-primary hover:bg-surface-container-lowest disabled:opacity-40 disabled:cursor-default cursor-pointer"
        >
          <Icon name="chevron-down" size={13} />
          {t("next")}
        </button>
        <button type="button" onClick={onExit} className="h-7 px-3 rounded-control text-caption font-bold bg-surface-container-lowest text-on-surface hover:bg-surface-container-high cursor-pointer">
          {t("exit")}
        </button>
      </div>

      {error && !diff && (
        <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-error">
          {t("loadFailed")}
        </p>
      )}
      {error && diff && (
        <p role="status" className="rounded-control bg-accent-gold-soft px-3 py-1.5 text-caption text-accent-gold-text">
          {t("staleNotice")}
        </p>
      )}
      {diff && diff.sections.length === 0 && <p className="text-body text-on-surface-muted italic">{t("empty")}</p>}
      {diff?.sections.map((section, si) => (
        <SectionBlock key={section.id} section={section} projectId={projectId} si={si} />
      ))}
    </div>
    </DecideContext.Provider>
  );
}
