"use client";

import { useState } from "react";
import type { Op } from "@/types/pipeline";
import type { Spine } from "@/types/spine";

interface NamesGlossaryPanelProps {
  spine: Pick<Spine, "actors" | "entities" | "screens" | "glossary">;
  onSubmitOps: (ops: Op[]) => Promise<void> | void;
  busy?: boolean;
}

type Tab = "actors" | "entities" | "screens" | "glossary";

const TABS: { id: Tab; label: string }[] = [
  { id: "actors", label: "Actor" },
  { id: "entities", label: "Thực thể" },
  { id: "screens", label: "Màn hình" },
  { id: "glossary", label: "Thuật ngữ" },
];

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

/**
 * Panel Tên riêng / Glossary (Phases §2.3): khai tên chuẩn một lần qua form, gửi `POST /changes {ops}`.
 * Chỉ sửa field có khoá; tên nhắc trong văn xuôi không tự đổi (S-8.4 Consistency Pass bắt phần đó).
 */
export default function NamesGlossaryPanel({ spine, onSubmitOps, busy = false }: NamesGlossaryPanelProps) {
  const [tab, setTab] = useState<Tab>("actors");
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [newTerm, setNewTerm] = useState({ term: "", definition: "" });

  const rows =
    tab === "glossary"
      ? spine.glossary.map((g) => ({ id: g.id, value: g.term, hint: g.definition }))
      : spine[tab].map((el) => ({ id: el.id, value: el.name, hint: "" }));
  const field = tab === "glossary" ? "term" : "name";
  const original = Object.fromEntries(rows.map((r) => [r.id, r.value]));

  const save = async () => {
    const ops = buildNameOps(tab, field, original, edited);
    if (tab === "glossary" && newTerm.term.trim()) {
      const next = spine.glossary.length + 1;
      ops.push({
        op: "add",
        path: "glossary[]",
        value: { id: `G${String(next).padStart(2, "0")}`, term: newTerm.term.trim(), definition: newTerm.definition.trim() },
        reason: "Panel Tên riêng",
      });
    }
    if (ops.length === 0) return;
    await onSubmitOps(ops);
    setEdited({});
    setNewTerm({ term: "", definition: "" });
  };

  return (
    <div className="flex flex-col gap-2" aria-label="Tên riêng và thuật ngữ">
      <div role="tablist" className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setEdited({});
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer ${tab === t.id ? "bg-[#191817] text-white" : "bg-[#F0EEEA] text-[#6B6862]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
        {rows.length === 0 && <div className="text-[11.5px] text-[#A8A49C] italic">Chưa có mục nào.</div>}
        {rows.map((row) => (
          <label key={row.id} className="flex items-center gap-2">
            <span className="font-mono text-[10.5px] text-[#8A867E] w-12 shrink-0">{row.id}</span>
            <input
              value={edited[row.id] ?? row.value}
              onChange={(e) => setEdited((prev) => ({ ...prev, [row.id]: e.target.value }))}
              title={row.hint}
              className="flex-1 px-2 py-1 border border-[#E5E3DF] rounded-[8px] text-[12px] outline-none focus:border-[#6A62C4]"
            />
          </label>
        ))}
        {tab === "glossary" && (
          <div className="flex items-center gap-2 pt-1">
            <input
              placeholder="Thuật ngữ mới"
              value={newTerm.term}
              onChange={(e) => setNewTerm((prev) => ({ ...prev, term: e.target.value }))}
              className="w-32 px-2 py-1 border border-[#E5E3DF] rounded-[8px] text-[12px] outline-none"
            />
            <input
              placeholder="Định nghĩa (tiếng Anh)"
              value={newTerm.definition}
              onChange={(e) => setNewTerm((prev) => ({ ...prev, definition: e.target.value }))}
              className="flex-1 px-2 py-1 border border-[#E5E3DF] rounded-[8px] text-[12px] outline-none"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="self-end px-3 py-1 rounded-full text-[11.5px] font-bold bg-[#6A62C4] text-white disabled:opacity-50 cursor-pointer"
      >
        Lưu tên chuẩn
      </button>
    </div>
  );
}
