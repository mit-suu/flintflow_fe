"use client";

import { useState } from "react";
import Tabs from "@/components/ui/Tabs";
import type { Op } from "@/types/pipeline";
import type { Spine } from "@/types/spine";

interface NamesGlossaryPanelProps {
  spine: Pick<Spine, "actors" | "entities" | "screens" | "glossary">;
  onSubmitOps: (ops: Op[]) => Promise<void> | void;
  busy?: boolean;
}

type Tab = "actors" | "entities" | "screens" | "glossary";

const TAB_LABEL: Record<Tab, string> = { actors: "Actor", entities: "Thực thể", screens: "Màn hình", glossary: "Thuật ngữ" };
/** Danh sách dài hơn mức này chỉ hiện chừng ấy dòng + "Xem thêm" — không cuộn lồng trong panel đã cuộn. */
const PREVIEW_ROWS = 8;

/** Lô op `set <collection>[id=X].<field>` cho các ô đã sửa (bỏ ô không đổi). */
export const buildNameOps = (
  collection: Tab,
  field: "name" | "term" | "definition",
  original: Record<string, string>,
  edited: Record<string, string>
): Op[] =>
  Object.entries(edited)
    .filter(([id, value]) => value.trim() && value.trim() !== original[id])
    .map(([id, value]) => ({ op: "set", path: `${collection}[id=${id}].${field}`, value: value.trim(), reason: "Panel Tên riêng" }));

const inputClass =
  "w-full px-2 py-1 rounded-inner bg-surface-container text-[12.5px] text-on-surface outline-none focus:ring-2 focus:ring-primary/30";

/**
 * Tên & thuật ngữ (Phases §2.3): danh sách **chỉ đọc**, bấm một tên để sửa ngay tại dòng (Enter lưu, Esc huỷ) —
 * gửi `POST /changes {ops}`. Chỉ sửa field có khoá; tên nhắc trong văn xuôi không tự đổi (S-8.4 Consistency Pass
 * bắt phần đó).
 */
export default function NamesGlossaryPanel({ spine, onSubmitOps, busy = false }: NamesGlossaryPanelProps) {
  const [tab, setTab] = useState<Tab>("actors");
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState<{ term: string; definition: string } | null>(null);

  const rows =
    tab === "glossary"
      ? spine.glossary.map((g) => ({ id: g.id, value: g.term, hint: g.definition }))
      : spine[tab].map((el) => ({ id: el.id, value: el.name, hint: "" }));
  const field = tab === "glossary" ? "term" : "name";
  const shown = showAll ? rows : rows.slice(0, PREVIEW_ROWS);

  const switchTab = (next: Tab) => {
    setTab(next);
    setEditing(null);
    setAdding(null);
    setShowAll(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const original = rows.find((r) => r.id === editing.id)?.value ?? "";
    const ops = buildNameOps(tab, field, { [editing.id]: original }, { [editing.id]: editing.value });
    setEditing(null);
    if (ops.length > 0) await onSubmitOps(ops);
  };

  const saveNewTerm = async () => {
    if (!adding?.term.trim()) return;
    const next = spine.glossary.length + 1;
    await onSubmitOps([
      {
        op: "add",
        path: "glossary[]",
        value: { id: `G${String(next).padStart(2, "0")}`, term: adding.term.trim(), definition: adding.definition.trim() },
        reason: "Panel Tên riêng",
      },
    ]);
    setAdding(null);
  };

  return (
    <div className="flex flex-col gap-2" aria-label="Tên riêng và thuật ngữ">
      <Tabs
        label="Loại tên"
        idBase="names"
        value={tab}
        onChange={switchTab}
        className="self-stretch [&>button]:flex-1 [&>button]:justify-center [&>button]:px-1 [&>button]:gap-1 [&>button]:whitespace-nowrap [&>button]:text-[11.5px] [&>button]:h-7"
        options={(Object.keys(TAB_LABEL) as Tab[]).map((id) => ({
          value: id,
          label: TAB_LABEL[id],
          count: id === "glossary" ? spine.glossary.length : spine[id].length,
        }))}
      />

      <ul role="tabpanel" id="names-panel" aria-labelledby={`names-tab-${tab}`} className="flex flex-col">
        {rows.length === 0 && <li className="py-1.5 text-[12px] text-on-surface-muted">Chưa có mục nào.</li>}
        {shown.map((row) =>
          editing?.id === row.id ? (
            <li key={row.id} className="py-1">
              <input
                autoFocus
                aria-label={`Tên mới cho ${row.value}`}
                value={editing.value}
                disabled={busy}
                onChange={(e) => setEditing({ id: row.id, value: e.target.value })}
                onBlur={() => void saveEdit()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveEdit();
                  if (e.key === "Escape") setEditing(null);
                }}
                className={inputClass}
              />
            </li>
          ) : (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setEditing({ id: row.id, value: row.value })}
                title="Bấm để sửa tên"
                className="group/name w-full -mx-2 px-2 py-1.5 rounded-control flex items-center justify-between gap-2 text-left hover:bg-surface-container-low cursor-pointer"
              >
                <span className="min-w-0 flex flex-col">
                  <span className="text-[12.5px] text-on-surface truncate">{row.value}</span>
                  {row.hint && <span className="text-[11px] text-on-surface-muted line-clamp-2">{row.hint}</span>}
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-primary opacity-0 group-hover/name:opacity-100 group-focus-visible/name:opacity-100">
                  Sửa
                </span>
              </button>
            </li>
          )
        )}
      </ul>

      {rows.length > PREVIEW_ROWS && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="self-start text-[11.5px] font-semibold text-primary hover:underline cursor-pointer">
          {showAll ? "Thu gọn" : `Xem thêm ${rows.length - PREVIEW_ROWS}`}
        </button>
      )}

      {tab === "glossary" &&
        (adding ? (
          <div className="flex flex-col gap-1.5">
            <input
              autoFocus
              placeholder="Thuật ngữ mới"
              value={adding.term}
              onChange={(e) => setAdding({ ...adding, term: e.target.value })}
              className={inputClass}
            />
            <input
              placeholder="Định nghĩa (tiếng Anh)"
              value={adding.definition}
              onChange={(e) => setAdding({ ...adding, definition: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && void saveNewTerm()}
              className={inputClass}
            />
            <div className="flex justify-end gap-1.5">
              <button type="button" onClick={() => setAdding(null)} className="h-7 px-2.5 rounded-control text-[11.5px] font-bold text-on-surface-variant hover:bg-surface-container-high cursor-pointer">
                Huỷ
              </button>
              <button
                type="button"
                disabled={busy || !adding.term.trim()}
                onClick={() => void saveNewTerm()}
                className="h-7 px-2.5 rounded-control text-[11.5px] font-bold bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                Thêm
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding({ term: "", definition: "" })} className="self-start text-[11.5px] font-semibold text-primary hover:underline cursor-pointer">
            + Thêm thuật ngữ
          </button>
        ))}
    </div>
  );
}
