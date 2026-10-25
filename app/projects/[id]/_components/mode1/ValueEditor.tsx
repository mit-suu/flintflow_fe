"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import FieldChanges from "./FieldChanges";
import { useMode1Labels } from "./i18n";

/** Khoá giữ nguyên, không cho sửa tay (mã, nguồn gốc, cấp tiêu đề). */
const LOCKED_KEYS = new Set(["id", "source", "level"]);

interface Block {
  kind: string;
  text: string;
  rows: string[][] | null;
  image_ref: string | null;
}

const isBlockList = (v: unknown): v is Block[] =>
  Array.isArray(v) && v.every((b) => b !== null && typeof b === "object" && typeof (b as Block).kind === "string" && "text" in (b as object));
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** Bảng ⇒ chữ: mỗi hàng một dòng, ô cách nhau " | ". */
const rowsToText = (rows: string[][] | null) => (rows ?? []).map((r) => r.join(" | ")).join("\n");
const textToRows = (text: string) =>
  text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => line.split("|").map((c) => c.trim()));

const area = "w-full px-2.5 py-1.5 rounded-[8px] border border-outline-variant bg-white text-body";
const rowsFor = (text: string) => Math.min(8, Math.max(2, text.split("\n").length + Math.floor(text.length / 70)));

/** Các đoạn / bảng của mục riêng — sửa chữ từng đoạn, thêm / xoá đoạn; ảnh giữ nguyên. */
function BlocksEditor({ blocks, onChange }: { blocks: Block[]; onChange: (next: Block[]) => void }) {
  const t = useTranslations("mode1.valueEditor");
  const set = (i: number, patch: Partial<Block>) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((b, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-caption font-semibold text-on-surface-muted">
            <span>
              {b.kind === "table"
                ? t("tableBlock", { n: i + 1 })
                : b.kind === "image"
                  ? t("imageBlock", { n: i + 1 })
                  : b.kind === "list_item"
                    ? t("listBlock", { n: i + 1 })
                    : t("paragraphBlock", { n: i + 1 })}
            </span>
            {b.kind !== "image" && (
              <button type="button" onClick={() => onChange(blocks.filter((_, j) => j !== i))} className="text-[#B03030]" aria-label={t("removeAria", { n: i + 1 })}>
                {t("remove")}
              </button>
            )}
          </div>
          {b.kind === "image" ? (
            <p className="text-body text-on-surface-muted italic">{t("imageKept")}</p>
          ) : b.kind === "table" ? (
            <textarea aria-label={t("tableAria", { n: i + 1 })} value={rowsToText(b.rows)} rows={rowsFor(rowsToText(b.rows))} onChange={(e) => set(i, { rows: textToRows(e.target.value) })} className={`${area} font-mono text-body`} />
          ) : (
            <textarea aria-label={t("paragraphAria", { n: i + 1 })} value={b.text} rows={rowsFor(b.text)} onChange={(e) => set(i, { text: e.target.value })} className={area} />
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange([...blocks, { kind: "paragraph", text: "", rows: null, image_ref: null }])} className="text-body font-semibold text-primary-hover underline">
          {t("addParagraph")}
        </button>
        <button type="button" onClick={() => onChange([...blocks, { kind: "list_item", text: "", rows: null, image_ref: null }])} className="text-body font-semibold text-primary-hover underline">
          {t("addListItem")}
        </button>
      </div>
    </div>
  );
}

/**
 * Tự sửa một phần tử (3.9, phase 8): hiện từng trường với nhãn theo ngôn ngữ thay vì JSON — chữ ⇒ ô chữ, danh sách ⇒ mỗi
 * dòng một mục, mục riêng ⇒ từng đoạn / bảng; trường lồng phức tạp ⇒ ô "nâng cao". Xem trước thay đổi trước khi lưu.
 * `oldText` / `startText` là giá trị phần tử dạng JSON (như `proposal.old_text` / `new_text`).
 */
export default function ValueEditor({
  oldText,
  startText,
  busy = false,
  onSave,
  onCancel,
}: {
  oldText: string;
  startText: string;
  busy?: boolean;
  onSave: (value: unknown) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("mode1.valueEditor");
  const { fieldLabel } = useMode1Labels();
  const start = useMemo(() => parse(startText), [startText]);
  const [value, setValue] = useState<Record<string, unknown> | null>(() =>
    start && typeof start === "object" && !Array.isArray(start) ? { ...(start as Record<string, unknown>) } : null
  );
  // Trường không sửa bằng ô thường được (object / mảng object) — sửa JSON riêng từng trường
  const [raw, setRaw] = useState<Record<string, string>>({});
  // Phần tử không phải object (vd mục trống là mảng) ⇒ cả khối JSON
  const [whole, setWhole] = useState(startText);

  if (!value) {
    const parsed = parse(whole);
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-body text-on-surface-muted">{t("listHint")}</p>
        <textarea aria-label={t("newContent")} value={whole} rows={8} spellCheck={false} onChange={(e) => setWhole(e.target.value)} className={`${area} font-mono text-body`} />
        {parsed === null && <p className="text-body text-[#B03030]">{t("invalidFormat")}</p>}
        <Actions busy={busy} disabled={parsed === null || whole.trim() === oldText.trim()} onSave={() => onSave(parsed)} onCancel={onCancel} />
      </div>
    );
  }

  const rawErrors = Object.entries(raw).filter(([, text]) => parse(text) === null && text.trim() !== "null");
  const merged: Record<string, unknown> = { ...value, ...Object.fromEntries(Object.entries(raw).map(([k, text]) => [k, parse(text)])) };
  const nextText = JSON.stringify(merged);
  const unchanged = JSON.stringify(parse(oldText)) === JSON.stringify(merged);
  const set = (key: string, v: unknown) => setValue((prev) => ({ ...(prev ?? {}), [key]: v }));

  return (
    <div className="flex flex-col gap-2">
      {Object.entries(value)
        .filter(([key]) => !LOCKED_KEYS.has(key))
        .map(([key, v]) => (
          <div key={key} className="flex flex-col gap-1">
            <span className="text-body font-bold text-on-surface">{key === "blocks" ? t("content") : fieldLabel(key)}</span>
            {typeof v === "string" ? (
              <textarea aria-label={fieldLabel(key)} value={v} rows={rowsFor(v)} onChange={(e) => set(key, e.target.value)} className={area} />
            ) : typeof v === "number" ? (
              <input aria-label={fieldLabel(key)} type="number" value={v} onChange={(e) => set(key, Number(e.target.value))} className={area} />
            ) : typeof v === "boolean" ? (
              <label className="flex items-center gap-1.5 text-body">
                <input type="checkbox" checked={v} onChange={(e) => set(key, e.target.checked)} /> {t("yes")}
              </label>
            ) : v === null ? (
              <textarea aria-label={fieldLabel(key)} value="" rows={2} placeholder={t("empty")} onChange={(e) => set(key, e.target.value)} className={area} />
            ) : isStringList(v) ? (
              <>
                <textarea aria-label={fieldLabel(key)} value={v.join("\n")} rows={Math.max(2, v.length + 1)} onChange={(e) => set(key, e.target.value.split("\n"))} className={area} />
                <span className="text-caption text-on-surface-muted">{t("onePerLine")}</span>
              </>
            ) : key === "blocks" && isBlockList(v) ? (
              <BlocksEditor blocks={v} onChange={(next) => set(key, next)} />
            ) : (
              <textarea
                aria-label={t("advancedAria", { label: fieldLabel(key) })}
                value={raw[key] ?? JSON.stringify(v, null, 2)}
                rows={6}
                spellCheck={false}
                onChange={(e) => setRaw((prev) => ({ ...prev, [key]: e.target.value }))}
                className={`${area} font-mono text-body`}
              />
            )}
          </div>
        ))}
      {rawErrors.length > 0 && <p className="text-body text-[#B03030]">{t("advancedInvalid", { fields: rawErrors.map(([k]) => fieldLabel(k)).join(", ") })}</p>}
      {!unchanged && rawErrors.length === 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-caption font-bold text-on-surface-muted">{t("preview")}</span>
          <FieldChanges oldText={oldText} newText={nextText} />
        </div>
      )}
      <Actions busy={busy} disabled={unchanged || rawErrors.length > 0} onSave={() => onSave(merged)} onCancel={onCancel} />
    </div>
  );
}

function Actions({ busy, disabled, onSave, onCancel }: { busy: boolean; disabled: boolean; onSave: () => void; onCancel?: () => void }) {
  const t = useTranslations("mode1.valueEditor");
  return (
    <div className="flex gap-1.5 justify-end">
      {onCancel && (
        <button type="button" onClick={onCancel} className="px-3 py-1 rounded-[8px] text-body font-bold text-on-surface-muted">
          {t("cancel")}
        </button>
      )}
      <button type="button" disabled={busy || disabled} onClick={onSave} className="px-3 py-1 rounded-[8px] text-body font-bold bg-on-surface text-surface disabled:opacity-50">
        {busy ? t("saving") : t("save")}
      </button>
    </div>
  );
}
