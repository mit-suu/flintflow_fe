"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import Icon from "@/components/ui/Icon";
import { SECTION_BINS, binOfSection, type SectionBinKey } from "@/lib/section-bins";
import type { StructurePreview, TargetSectionStatus } from "@/types/import";
import type { Locale } from "@/lib/i18n";
import { importSectionTitle } from "./section-titles";

interface StructureAbsorbProps {
  sections: StructurePreview["sections"];
  /** Khoá "đã xem hiệu ứng" (theo lần import) — mở lại dự án thì vào thẳng trạng thái đã lắng. */
  playKey: string;
}

/** Số khối mờ trên trang khi chưa có mục. */
const LOADING_BLOCKS = 12;

/**
 * Cùng bố cục màn đọc khung trong lúc file còn đang tải / BE đang đọc khung: trang giấy chưa có mục (khối mờ + đường quét chạy
 * lặp), các ô chờ ở 0. Có kết quả thì `StructureAbsorb` thay vào và cắt mục ngay — không qua màn chờ khác.
 */
export function StructureAbsorbLoading() {
  const t = useTranslations("workspace.import.absorb");
  const reduceMotion = useReducedMotion();
  const bins = SECTION_BINS.filter((b) => b.key !== "verbatim");
  return (
    <div role="status" aria-label={t("reading")} className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
      <section className="flex flex-col gap-2 min-w-0 lg:h-0 lg:min-h-full">
        <div className="flex items-center min-h-6">
          <h3 className="text-body font-bold text-on-surface-medium">{t("documentLabel")}</h3>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="relative flex-1 min-h-0 rounded-card bg-surface-container-lowest shadow-[0_1px_2px_rgba(30,25,60,0.06),0_10px_30px_-14px_rgba(30,25,60,0.22)] overflow-hidden">
            <ol aria-hidden className="flex flex-col px-6 sm:px-8 py-6 gap-1 animate-pulse">
              {Array.from({ length: LOADING_BLOCKS }, (_, i) => {
                const [a, b] = linesOf(`loading-${i}`);
                return (
                  <li key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                    <span className="w-3.5 h-3.5 mt-[3px] shrink-0 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-on-surface/15" />
                    </span>
                    <span className="flex-1 flex flex-col gap-1.5">
                      <span className="h-3 mt-1 rounded-full bg-on-surface/[0.12]" style={{ width: `${30 + (a % 25)}%` }} />
                      <span className="h-1.5 rounded-full bg-on-surface/[0.07]" style={{ width: `${a}%` }} />
                      <span className="h-1.5 rounded-full bg-on-surface/[0.07]" style={{ width: `${b}%` }} />
                    </span>
                  </li>
                );
              })}
            </ol>
            {!reduceMotion && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0"
                initial={{ y: 0 }}
                animate={{ y: ["0%", "100%"] }}
                style={{ height: "100%" }}
                transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
              >
                <div className="absolute inset-x-0 -top-10 h-10 bg-gradient-to-b from-transparent to-primary/10" />
                <div className="absolute inset-x-0 top-0 h-[2px] bg-primary/70" />
                <span className="absolute left-2 -top-[5px] w-3 h-3 rounded-full bg-primary" />
              </motion.div>
            )}
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center min-h-6">
          <h3 className="text-body font-bold text-on-surface-medium">{t("storeLabel")}</h3>
        </div>
        <ul aria-hidden className="flex flex-col gap-0.5 rounded-card bg-surface-container p-1.5">
          {bins.map((b) => (
            <li key={b.key} className="min-h-[52px] flex items-center gap-3 rounded-control px-2.5 py-2">
              <span className="w-8 h-8 shrink-0 rounded-inner flex items-center justify-center bg-primary-soft text-primary/60">
                <Icon name={b.icon} size={16} />
              </span>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-body font-semibold text-on-surface truncate">{t(`bins.${b.key}`)}</span>
                <span className="text-caption text-on-surface-muted">{t("readingBin")}</span>
              </span>
              <span className="shrink-0 w-12 flex flex-col items-end gap-1">
                <span className="tabular-nums text-heading font-bold leading-none text-on-surface-muted">0</span>
                <span className="h-1 w-full rounded-full bg-surface-container-highest/70" />
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type Section = StructurePreview["sections"][number];

interface Point {
  x: number;
  y: number;
}
/** Một mảnh cắt khỏi trang: vị trí/kích thước lúc cắt (theo khung bao) và đích là tâm icon của ô. */
interface Piece {
  id: string;
  section: Section;
  bin: SectionBinKey;
  from: Point;
  w: number;
  h: number;
  to: Point;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const FLIGHT_S = 1;
/** Thời gian đường cắt chạy hết trang — tỉ lệ số mục, kẹp để file nhỏ không chớp nhoáng, file lớn không bắt chờ lâu. */
const SCAN_MS_PER_SECTION = 70;
const SCAN_MIN_MS = 2600;
const SCAN_MAX_MS = 6500;
/** Đường cắt đứng ở khoảng này của khung nhìn khi trang cuộn theo. */
const CUT_LINE_AT = 0.42;

const STATUS_LOOK: Record<TargetSectionStatus, { icon: "check-circle" | "error-circle" | "archive"; icon_cls: string; pill: string }> = {
  present: { icon: "check-circle", icon_cls: "text-success", pill: "bg-success-soft text-success" },
  missing: { icon: "error-circle", icon_cls: "text-accent-gold-text", pill: "bg-accent-gold-soft text-accent-gold-text" },
  out_of_scope: { icon: "archive", icon_cls: "text-on-surface-muted", pill: "bg-surface-container-high text-on-surface-muted" },
};

/** Độ dài các dòng chữ giả của một mục — cố định theo mã mục để vẽ lại không nhảy. */
const linesOf = (id: string): number[] => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return [92 - (h % 14), 58 + ((h >> 4) % 30)];
};

const seenKey = (k: string) => `ff:absorb-seen:${k}`;
const readSeen = (k: string) => {
  try {
    return localStorage.getItem(seenKey(k)) === "1";
  } catch {
    return false;
  }
};
const writeSeen = (k: string) => {
  try {
    localStorage.setItem(seenKey(k), "1");
  } catch {
    // chế độ riêng tư — lần sau chạy lại hiệu ứng
  }
};

/**
 * Màn đọc khung kiểu "cắt tài liệu vào kho": trái là trang tài liệu của khách (mỗi mục một khối tiêu đề + dòng chữ), phải là các
 * ô nội dung FlintFlow nắm. Một đường cắt chạy dọc trang (trang tự cuộn theo); mục nào đường cắt đi qua thì bị tách khỏi trang, bay
 * theo đường cong và thu nhỏ vào đúng ô của nó — ô đếm lên và đầy dần. Ô không có mục nào bay tới là phần còn trống sẽ soạn.
 * Hiệu ứng chỉ kể lại kết quả BE đã tính: chạy một lần mỗi lần upload, bỏ qua / xem lại được, tắt khi bật giảm chuyển động.
 * Rê / bấm vào ô để xem các mục nguồn.
 */
export default function StructureAbsorb({ sections, playKey }: StructureAbsorbProps) {
  const t = useTranslations("workspace.import.absorb");
  const reduceMotion = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const cutLineRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const chipRefs = useRef(new Map<SectionBinKey, HTMLSpanElement>());
  const rafRef = useRef(0);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [cut, setCut] = useState<ReadonlySet<string>>(new Set());
  const [arrived, setArrived] = useState<Record<string, number>>({});
  const [playing, setPlaying] = useState(false);
  /** Hiệu ứng sắp chạy (chưa tới khung hình đầu) — trang đã phải ở dạng thô, không được loé nhãn trạng thái. */
  const [pending, setPending] = useState(() => typeof window !== "undefined" && sections.length > 0 && !readSeen(playKey));
  const [scanning, setScanning] = useState(false);
  const [round, setRound] = useState(0);
  const [focusBin, setFocusBin] = useState<SectionBinKey | null>(null);
  const [pinnedBin, setPinnedBin] = useState<SectionBinKey | null>(null);
  const activeBin = pinnedBin ?? focusBin;

  const binOf = useMemo(() => new Map(sections.map((s) => [s.section_id, binOfSection(s.section_id)])), [sections]);
  const totals = useMemo(() => {
    const out: Record<string, { total: number; present: number }> = {};
    for (const s of sections) {
      const b = binOf.get(s.section_id)!;
      out[b] ??= { total: 0, present: 0 };
      out[b].total += 1;
      if (s.status === "present") out[b].present += 1;
    }
    return out;
  }, [sections, binOf]);
  const bins = SECTION_BINS.filter((b) => b.key !== "verbatim" || (totals.verbatim?.total ?? 0) > 0);
  // Màn cha poll lại preview ⇒ `sections` đổi tham chiếu; vòng cắt đọc qua ref để không bị huỷ giữa chừng
  const dataRef = useRef({ sections, binOf });
  useEffect(() => {
    dataRef.current = { sections, binOf };
  }, [sections, binOf]);

  const finish = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    setPending(false);
    setScanning(false);
    setPieces([]);
    setCut(new Set());
    if (paperRef.current) paperRef.current.scrollTop = 0;
  }, []);

  // Chạy một lần mỗi lần upload (hoặc khi bấm Xem lại); giảm chuyển động / đã xem ⇒ vào thẳng trạng thái đã lắng
  useEffect(() => {
    if (reduceMotion || (round === 0 && readSeen(playKey))) return;
    const paper = paperRef.current;
    const wrap = wrapRef.current;
    const { sections, binOf } = dataRef.current;
    if (!paper || !wrap || sections.length === 0) return;
    const duration = Math.min(Math.max(sections.length * SCAN_MS_PER_SECTION, SCAN_MIN_MS), SCAN_MAX_MS);
    const launched = new Set<string>();
    let start = 0;

    const tick = (now: number) => {
      if (!start) {
        start = now;
        paper.scrollTop = 0;
        setArrived({});
        setCut(new Set());
        setPieces([]);
        setPlaying(true);
        setScanning(true);
        writeSeen(playKey);
      }
      const p = Math.min((now - start) / duration, 1);
      const total = paper.scrollHeight;
      const view = paper.clientHeight;
      // Con trỏ cắt theo toạ độ nội dung; trang cuộn để con trỏ đứng ở CUT_LINE_AT của khung nhìn
      const cursor = p * total;
      paper.scrollTop = Math.min(Math.max(cursor - view * CUT_LINE_AT, 0), Math.max(total - view, 0));
      if (cutLineRef.current) cutLineRef.current.style.transform = `translateY(${cursor - paper.scrollTop}px)`;

      const box = wrap.getBoundingClientRect();
      const fresh: Piece[] = [];
      for (const s of sections) {
        if (launched.has(s.section_id)) continue;
        const row = rowRefs.current.get(s.section_id);
        if (!row || row.offsetTop + row.offsetHeight / 2 > cursor) continue;
        const bin = binOf.get(s.section_id)!;
        const chip = chipRefs.current.get(bin)?.getBoundingClientRect();
        const r = row.getBoundingClientRect();
        launched.add(s.section_id);
        if (!chip) continue;
        fresh.push({
          id: s.section_id,
          section: s,
          bin,
          from: { x: r.left - box.left, y: r.top - box.top },
          w: r.width,
          h: r.height,
          to: { x: chip.left + chip.width / 2 - box.left, y: chip.top + chip.height / 2 - box.top },
        });
      }
      if (fresh.length) {
        setPieces((cur) => [...cur, ...fresh]);
        setCut((cur) => new Set([...cur, ...fresh.map((f) => f.id)]));
      }
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setScanning(false);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playKey, reduceMotion, round]);

  // Đường cắt đã hết trang và mảnh cuối đã vào ô ⇒ lắng (trang liền lại, ô giữ số cuối)
  useEffect(() => {
    if (!playing || scanning || pieces.length) return;
    const timer = setTimeout(finish, 350);
    return () => clearTimeout(timer);
  }, [playing, scanning, pieces.length, finish]);

  const land = useCallback((piece: Piece) => {
    setPieces((cur) => cur.filter((p) => p.id !== piece.id));
    setArrived((a) => ({ ...a, [piece.bin]: (a[piece.bin] ?? 0) + 1 }));
  }, []);

  /** Trang thô: tài liệu như khách viết, chưa đọc — không nhãn trạng thái, không có mục còn trống (file không có mục đó). */
  const raw = playing || (pending && !reduceMotion);
  const countIn = (bin: SectionBinKey) => (raw ? (arrived[bin] ?? 0) : (totals[bin]?.total ?? 0));
  const shownRows = raw
    ? sections.filter((s) => s.status !== "missing")
    : pinnedBin
      ? sections.filter((s) => binOf.get(s.section_id) === pinnedBin)
      : sections;

  // Rê / focus / ghim một nhóm ⇒ trang bên trái cuộn tới mục đầu tiên của nhóm nếu mục đó đang khuất (không bắt người dùng tự cuộn)
  useEffect(() => {
    const paper = paperRef.current;
    if (raw || !activeBin || !paper) return;
    const first = shownRows.find((s) => binOf.get(s.section_id) === activeBin);
    const row = first ? rowRefs.current.get(first.section_id) : undefined;
    if (!row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top >= paper.scrollTop && bottom <= paper.scrollTop + paper.clientHeight) return;
    paper.scrollTo({ top: Math.max(top - 16, 0), behavior: reduceMotion ? "auto" : "smooth" });
  }, [activeBin, raw, shownRows, binOf, reduceMotion]);

  return (
    <div ref={wrapRef} className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
      {/* Trang tài liệu của khách */}
      <section aria-label={t("documentLabel")} className="relative flex flex-col gap-2 min-w-0 lg:h-0 lg:min-h-full">
        <div className="flex items-center justify-between gap-2 min-h-6">
          <h3 className="text-body font-bold text-on-surface-medium">{t("documentLabel")}</h3>
          {pinnedBin && !raw && (
            <button type="button" onClick={() => setPinnedBin(null)} className="text-caption font-bold text-primary hover:underline cursor-pointer">
              {t("showAll")}
            </button>
          )}
        </div>
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div className="relative flex-1 min-h-0 flex flex-col rounded-card bg-surface-container-lowest shadow-[0_1px_2px_rgba(30,25,60,0.06),0_10px_30px_-14px_rgba(30,25,60,0.22)] overflow-hidden">
            <div ref={paperRef} data-testid="absorb-paper" className="max-h-[600px] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto ff-scroll">
              <ol className="relative flex flex-col px-6 sm:px-8 py-6 gap-1">
                {shownRows.map((s) => {
                  const bin = binOf.get(s.section_id)!;
                  const look = STATUS_LOOK[s.status];
                  const isCut = cut.has(s.section_id);
                  const dim = !raw && activeBin !== null && bin !== activeBin;
                  return (
                    <li
                      key={s.section_id}
                      ref={(node) => {
                        if (node) rowRefs.current.set(s.section_id, node);
                        else rowRefs.current.delete(s.section_id);
                      }}
                      className={`rounded-inner px-3 py-2.5 transition-[opacity,background-color] duration-300 ${
                        isCut ? "bg-primary-soft opacity-40" : dim ? "opacity-30" : "opacity-100"
                      } ${!raw && activeBin === bin ? "bg-primary-soft" : ""}`}
                    >
                      <SectionBlock section={s} look={look} statusLabel={t(`status.${s.status}`)} hollow={isCut} raw={raw} />
                    </li>
                  );
                })}
              </ol>
            </div>
            {/* Đường cắt: chạy dọc trang trong lúc tách mục */}
            {scanning && (
              <div ref={cutLineRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 will-change-transform">
                <div className="absolute inset-x-0 -top-10 h-10 bg-gradient-to-b from-transparent to-primary/10" />
                <div className="absolute inset-x-0 top-0 h-[2px] bg-primary/70" />
                <span className="absolute left-2 -top-[5px] w-3 h-3 rounded-full bg-primary" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Các ô FlintFlow nắm được */}
      <section aria-label={t("storeLabel")} className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center justify-between gap-2 min-h-6">
          <h3 className="text-body font-bold text-on-surface-medium">{t("storeLabel")}</h3>
          {playing ? (
            <button type="button" onClick={finish} className="text-caption font-bold text-primary hover:underline cursor-pointer">
              {t("skip")}
            </button>
          ) : (
            !reduceMotion && (
              <button type="button" onClick={() => setRound((r) => r + 1)} className="inline-flex items-center gap-1 text-caption font-bold text-primary hover:underline cursor-pointer">
                <Icon name="play" size={12} />
                {t("replay")}
              </button>
            )
          )}
        </div>
        {/* Bảng các nhóm: mỗi dòng một nhóm — icon, tên + chú thích, số mục + vạch đầy dần. Rê / focus ⇒ trang bên trái cuộn tới mục */}
        <ul className="flex flex-col gap-0.5 rounded-card bg-surface-container p-1.5">
          {bins.map((b) => {
            const total = totals[b.key]?.total ?? 0;
            const present = totals[b.key]?.present ?? 0;
            const count = countIn(b.key);
            const missing = total > 0 && b.key !== "verbatim" && present === 0;
            const empty = total === 0;
            const active = activeBin === b.key;
            const caption = empty ? t("binEmpty") : b.key === "verbatim" ? t("binVerbatim", { count: total }) : missing ? t("binMissing", { count: total }) : t("binCount", { count: total });
            const fill = total === 0 ? 0 : count / total;
            const tone = empty ? "muted" : missing ? "gold" : "primary";
            return (
              <li key={b.key}>
                <button
                  type="button"
                  aria-pressed={pinnedBin === b.key}
                  aria-label={`${t(`bins.${b.key}`)}: ${caption}`}
                  disabled={empty}
                  onMouseEnter={() => setFocusBin(b.key)}
                  onMouseLeave={() => setFocusBin(null)}
                  onFocus={() => setFocusBin(b.key)}
                  onBlur={() => setFocusBin(null)}
                  onClick={() => setPinnedBin((p) => (p === b.key ? null : b.key))}
                  className={`w-full min-h-[52px] text-left flex items-center gap-3 rounded-control px-2.5 py-2 transition-[background-color,box-shadow] duration-200 cursor-pointer disabled:cursor-default focus-visible:outline-2 focus-visible:outline-primary ${
                    active ? "bg-surface-container-lowest shadow-[0_1px_3px_rgba(30,25,60,0.1)]" : empty ? "" : "hover:bg-surface-container-high"
                  }`}
                >
                  <span
                    ref={(node) => {
                      if (node) chipRefs.current.set(b.key, node);
                      else chipRefs.current.delete(b.key);
                    }}
                    className="relative w-8 h-8 shrink-0"
                  >
                    {/* Gợn khi một mảnh vừa rơi vào */}
                    {playing && count > 0 && (
                      <motion.span
                        key={`ripple-${count}`}
                        aria-hidden
                        className={`absolute inset-0 rounded-inner ${tone === "gold" ? "bg-accent-gold" : "bg-primary"}`}
                        initial={{ scale: 1, opacity: 0.35 }}
                        animate={{ scale: 1.9, opacity: 0 }}
                        transition={{ duration: 0.5, ease: EASE_OUT }}
                      />
                    )}
                    <motion.span
                      key={`chip-${playing ? count : "rest"}`}
                      initial={playing && count > 0 ? { scale: 1.18 } : false}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 480, damping: 16 }}
                      className={`relative w-8 h-8 rounded-inner flex items-center justify-center transition-colors duration-200 ${
                        active && tone === "primary"
                          ? "bg-primary text-on-primary"
                          : tone === "gold"
                            ? "bg-accent-gold-soft text-accent-gold-text"
                            : tone === "muted"
                              ? "bg-surface-container-high text-on-surface-muted"
                              : "bg-primary-soft text-primary"
                      }`}
                    >
                      <Icon name={b.icon} size={16} />
                    </motion.span>
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className={`text-body font-semibold truncate ${empty ? "text-on-surface-muted" : "text-on-surface"}`}>{t(`bins.${b.key}`)}</span>
                    <span className={`text-caption truncate ${missing || empty ? "text-accent-gold-text" : "text-on-surface-muted"}`} title={caption}>
                      {caption}
                    </span>
                  </span>
                  <span className="shrink-0 w-12 flex flex-col items-end gap-1">
                    <motion.span
                      key={`n-${b.key}-${count}`}
                      initial={playing && count > 0 ? { y: -6, opacity: 0.4 } : false}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.22, ease: EASE_OUT }}
                      className={`tabular-nums text-heading font-bold leading-none ${empty ? "text-on-surface-muted" : "text-on-surface"}`}
                    >
                      {count}
                    </motion.span>
                    {/* Vạch đầy dần theo số mảnh đã vào nhóm */}
                    <span aria-hidden className="h-1 w-full rounded-full bg-surface-container-highest/70 overflow-hidden">
                      <motion.span
                        className={`block h-full w-full rounded-full origin-left ${tone === "gold" ? "bg-accent-gold" : "bg-primary"}`}
                        initial={false}
                        animate={{ scaleX: fill }}
                        transition={{ type: "spring", stiffness: 200, damping: 26 }}
                      />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          <li className="px-2.5 pt-2 pb-1 text-caption text-on-surface-muted">{t("hint")}</li>
        </ul>
      </section>

      {/* Lớp mảnh bay: khối mục tách khỏi trang, nhấc lên, bay vòng cung rồi thu vào icon của ô */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible z-10">
        {pieces.map((p) => {
          const tx = p.to.x - p.w / 2;
          const ty = p.to.y - p.h / 2;
          const arc = Math.min(p.from.y, ty) - 60;
          return (
            <motion.div
              key={`piece-${round}-${p.id}`}
              className="absolute left-0 top-0 rounded-inner bg-surface-container-lowest px-3 py-2.5 shadow-[0_12px_32px_-8px_rgba(60,50,140,0.35)]"
              style={{ width: p.w, height: p.h }}
              initial={{ x: p.from.x, y: p.from.y, scale: 1, opacity: 1, rotate: 0 }}
              animate={{
                x: [p.from.x, p.from.x + 10, (p.from.x + tx) / 2 + 40, tx],
                y: [p.from.y, p.from.y - 10, arc, ty],
                scale: [1, 1.04, 0.55, 0.08],
                rotate: [0, -1.5, 1, 0],
                opacity: [1, 1, 1, 0],
              }}
              transition={{ duration: FLIGHT_S, ease: EASE_OUT, times: [0, 0.16, 0.6, 1] }}
              onAnimationComplete={() => land(p)}
            >
              <SectionBlock section={p.section} look={STATUS_LOOK[p.section.status]} statusLabel={t(`status.${p.section.status}`)} />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

interface SectionBlockProps {
  section: Section;
  look: (typeof STATUS_LOOK)[TargetSectionStatus];
  statusLabel: string;
  /** Chỗ trống mục để lại trên trang sau khi bị cắt ra. */
  hollow?: boolean;
  /** Chưa đọc: mục như khách viết — chưa có icon / nhãn trạng thái; nhãn chỉ gắn lúc mục bị cắt ra. */
  raw?: boolean;
}

/** Một mục như trên trang giấy: tiêu đề + hai dòng chữ giả (mục còn trống thì không có chữ) + nhãn trạng thái. */
function SectionBlock({ section, look, statusLabel, hollow = false, raw = false }: SectionBlockProps) {
  const locale = useLocale() as Locale;
  const lines = linesOf(section.section_id);
  const title = importSectionTitle(section.section_id, section.title, locale);
  const hasBody = section.status !== "missing";
  return (
    <div className={`flex items-start gap-2.5 ${hollow ? "invisible" : ""}`}>
      {raw ? (
        <span aria-hidden className="w-3.5 h-3.5 mt-[3px] shrink-0 flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-on-surface/20" />
        </span>
      ) : (
        <Icon name={look.icon} size={14} className={`mt-[3px] shrink-0 ${look.icon_cls}`} />
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <span className={`text-body font-semibold truncate ${raw || section.status === "present" ? "text-on-surface" : "text-on-surface-muted"}`} title={title}>
          {title}
        </span>
        {hasBody && (
          <span aria-hidden className="flex flex-col gap-1">
            {lines.map((w, i) => (
              <span key={i} className="h-1.5 rounded-full bg-on-surface/[0.07]" style={{ width: `${w}%` }} />
            ))}
          </span>
        )}
      </div>
      {!raw && <span className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-medium ${look.pill}`}>{statusLabel}</span>}
    </div>
  );
}
