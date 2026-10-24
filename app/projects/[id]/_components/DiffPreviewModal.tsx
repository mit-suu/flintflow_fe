"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ChangeDiff, ChangeRequestInfo, PreviewResult } from "@/types/pipeline";
import type { Spine } from "@/types/spine";
import { refNames, resolveRefs, type RefNames } from "./mode1/spine-labels";
import { CR_SOURCE_KINDS } from "./mode1/labels";
import { useMode1Labels } from "./mode1/i18n";

interface DiffPreviewModalProps {
  preview: PreviewResult;
  busy?: boolean;
  onCancel: () => void;
  /**
   * `reason` + `changeRequest` chỉ có khi nhánh là `post_baseline`: sau baseline lượt áp là một change request
   * (BR-03, FLF-294) — BE bắt buộc người yêu cầu + nguồn + lý do, ghi `CR-nnn` vào §I Record of Changes.
   */
  onConfirm: (reason?: string, changeRequest?: ChangeRequestInfo) => void;
  /** Mode 1 v3: "Tạo CR" thay "Xác nhận" — bản xem trước dùng để soạn change request, không áp thẳng. */
  confirmLabel?: string;
  busyLabel?: string;
  /** Dòng giải thích ngay trên nút (vd "tài liệu chỉ đổi sau khi CR được duyệt"). */
  note?: string;
  /** Cho bấm xác nhận cả khi bản xem trước lỗi (mode 1 v3: vẫn tạo CR, chỉ không kèm bản xem trước). */
  confirmWhenInvalid?: boolean;
  /** Spine hiện tại — đổi mã tham chiếu (`A01`) thành tên (`Lecturer`) trong bảng diff. */
  spine?: Spine | null;
}

/** `deletedText`: chữ cho giá trị đã bị xoá (`workspace.diff.deleted`); `readableValue` theo ngôn ngữ (`useMode1Labels`). */
const short = (
  value: unknown,
  field: string | undefined,
  names: RefNames,
  deletedText: string,
  readableValue: (value: unknown, names?: RefNames) => string
): string => {
  if (value === undefined) return "—";
  if (value === null) return "—";
  if (typeof value === "object" && "_absent" in (value as Record<string, unknown>)) return deletedText;
  const text = readableValue(resolveRefs(field, value, names), names);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
};

/** Field cuối của path: `use_cases[id=UC27].actor_ids` ⇒ `actor_ids`; path trỏ cả phần tử ⇒ undefined. */
const lastField = (path: string): string | undefined => /\.([a-z_]+)$/.exec(path)?.[1];

const isEmptyList = (v: unknown) => v === undefined || v === null || (Array.isArray(v) && v.length === 0);

/**
 * Use case sau lô sửa không gắn chức năng nào (thêm mới thiếu `function_ids`, hoặc xoá hết) — truy vết UC → chức năng
 * (UC-78) sẽ hụt. Trả tên/mã để cảnh báo trước khi áp (FLF-297).
 */
const useCasesWithoutFunction = (changes: ChangeDiff[], labels: { newUseCase: string; useCase: string }): string[] =>
  changes.flatMap((c) => {
    if (c.op === "remove" || !c.path.startsWith("use_cases[")) return [];
    const id = /^use_cases\[(?:id=)?([^\]]*)\]/.exec(c.path)?.[1];
    if (/^use_cases\[[^\]]*\]$/.test(c.path)) {
      const uc = c.value as Record<string, unknown> | null;
      if (!uc || typeof uc !== "object" || !isEmptyList(uc.function_ids)) return [];
      return [typeof uc.name === "string" && uc.name ? uc.name : id || labels.newUseCase];
    }
    return lastField(c.path) === "function_ids" && isEmptyList(c.value) ? [id || labels.useCase] : [];
  });

/** Quan hệ của mục bị ảnh hưởng có nhãn riêng (`workspace.diff.relation.*`); quan hệ lạ ⇒ "liên quan". */
const RELATIONS = ["owner", "reads", "derived"] as const;
const isKnownRelation = (relation: string): relation is (typeof RELATIONS)[number] => (RELATIONS as readonly string[]).includes(relation);

/** Bảng diff trước khi áp lệnh sửa (UC 6.8): path / before / value / section ảnh hưởng / diagram. */
export default function DiffPreviewModal({
  preview,
  busy = false,
  onCancel,
  onConfirm,
  confirmLabel,
  busyLabel,
  note,
  confirmWhenInvalid = false,
  spine,
}: DiffPreviewModalProps) {
  const t = useTranslations("workspace.diff");
  const { pathLabel, readableValue, ruleLabel, sectionName, violationText, crSource } = useMode1Labels();
  const [reason, setReason] = useState("");
  const [requester, setRequester] = useState("");
  const [sourceKind, setSourceKind] = useState<ChangeRequestInfo["source"]["kind"] | "">("");
  const [sourceRef, setSourceRef] = useState("");
  const names = useMemo(() => refNames(spine), [spine]);
  const unlinkedUseCases = useCasesWithoutFunction(preview.changes, { newUseCase: t("newUseCase"), useCase: t("useCase") });
  // Tài liệu đã ký baseline: `change.service` từ chối lô không có lý do (400). Hỏi ngay ở đây thay vì
  // để user bấm Xác nhận rồi ăn lỗi khó hiểu. Luồng CR (`confirmWhenInvalid`) không áp thẳng — lý do
  // không đi đâu ở bước này nên không hỏi, tránh bắt gõ một câu rồi âm thầm vứt đi.
  const needsReason = !confirmWhenInvalid && preview.branch === "post_baseline";
  const hasViolations = preview.violations.length > 0;
  // BUG-27: "Không có thay đổi nào" mà vẫn có nút Xác nhận là mời user bấm vào chỗ không làm gì.
  // Ngoại lệ: lượt hoà giải trả `no_change` — ở đó xác nhận CÓ nghĩa ("nội dung vẫn đúng", gỡ cờ).
  // Luồng CR của mode 1 v3 (`confirmWhenInvalid`) thì "Tạo CR" vẫn có nghĩa kể cả khi bản xem trước rỗng:
  // CR dựng từ câu lệnh, bản xem trước chỉ là thứ kèm thêm.
  const empty = !confirmWhenInvalid && preview.changes.length === 0 && !preview.no_change;
  const canConfirm =
    (confirmWhenInvalid || (preview.ok && !hasViolations && Boolean(preview.preview_id))) &&
    !empty &&
    !busy &&
    (!needsReason || (reason.trim().length > 0 && requester.trim().length > 0 && sourceKind !== ""));
  const changeRequest = (): ChangeRequestInfo | undefined =>
    needsReason && sourceKind !== ""
      ? { requester: requester.trim(), source: { kind: sourceKind, ref: sourceRef.trim() || null } }
      : undefined;

  return (
    <div className="fixed inset-0 bg-black/35 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-[20px] p-6 w-[640px] max-w-full max-h-[85vh] ff-scroll overflow-y-auto shadow-[0_30px_80px_rgba(0,0,0,0.3)] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-extrabold text-heading text-[#191817]">{t("title")}</h3>
          <div className="flex items-center gap-2">
            {preview.branch && (
              <span className="px-2 py-0.5 rounded-full text-caption font-bold bg-[#F2F1FB] text-[#6A62C4]">{t(`branch.${preview.branch}`)}</span>
            )}
            <button type="button" onClick={onCancel} aria-label={t("close")} className="p-1.5 hover:bg-[#F5F3F0] rounded-full text-[#8A867E] cursor-pointer">
              ✕
            </button>
          </div>
        </div>

        {hasViolations && (
          <div className="bg-[#FDEDED] border border-[#F2CACA] rounded-[12px] p-3 flex flex-col gap-1.5">
            {preview.violations.map((v, i) => (
              <div key={i} className="text-body text-[#8A4141]">
                {ruleLabel(v.rule) && <span className="font-bold">{ruleLabel(v.rule)}: </span>}
                <span title={[v.rule, v.path, v.message].filter(Boolean).join(" · ")}>{violationText(v)}</span>
                {v.path && <span className="text-caption"> ({pathLabel(v.path)})</span>}
              </div>
            ))}
          </div>
        )}

        {preview.changes.length === 0 ? (
          <div className="text-body py-4 text-center flex flex-col gap-1">
            <span className="text-[#A8A49C] italic">{t("none")}</span>
            {preview.no_change && (
              <span className="text-[#4B4842]">
                {preview.notes ?? t("noChangeNote")}
              </span>
            )}
          </div>
        ) : (
          <div className="ff-scroll overflow-x-auto">
            <table className="w-full border-collapse text-caption">
              <thead>
                <tr>
                  <th className="border border-[#ECEAE5] bg-[#FAF9F7] px-2 py-1 text-left font-bold">{t("colPath")}</th>
                  <th className="border border-[#ECEAE5] bg-[#FAF9F7] px-2 py-1 text-left font-bold">{t("colBefore")}</th>
                  <th className="border border-[#ECEAE5] bg-[#FAF9F7] px-2 py-1 text-left font-bold">{t("colAfter")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.changes.map((change, i) => (
                  <tr key={i}>
                    <td className="border border-[#ECEAE5] px-2 py-1 align-top" title={change.path}>
                      {pathLabel(change.path)}
                    </td>
                    <td className="border border-[#ECEAE5] px-2 py-1 align-top text-[#B03030]">{short(change.before, lastField(change.path), names, t("deleted"), readableValue)}</td>
                    <td className="border border-[#ECEAE5] px-2 py-1 align-top text-[#1F7A45]">{short(change.value, lastField(change.path), names, t("deleted"), readableValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {unlinkedUseCases.length > 0 && (
          <div role="alert" className="bg-[#FFF7E6] border border-[#F0DDB0] rounded-[12px] p-3 text-body text-[#8A6D1F]">
            {t("unlinked", { names: unlinkedUseCases.map((n) => `“${n}”`).join(", ") })}
          </div>
        )}

        {preview.impact && (
          <div className="bg-[#FAF9F7] border border-[#ECEAE5] rounded-[12px] p-3 flex flex-col gap-2 text-caption text-[#4B4842]">
            <div className="font-extrabold text-caption text-[#8A867E] tracking-wider uppercase">{t("impact")}</div>
            {preview.impact.sections.length > 0 && (
              <div>
                {t("impactSections")}{" "}
                {preview.impact.sections.map((s) => (
                  <span key={s.id} className="mr-1.5" title={s.id}>
                    {sectionName(s.id)}
                    <span className="text-[#A8A49C]"> ({isKnownRelation(s.relation) ? t(`relation.${s.relation}`) : t("relation.other")})</span>
                  </span>
                ))}
              </div>
            )}
            {preview.impact.diagrams.length > 0 && (
              <div>{t("impactDiagrams", { count: preview.impact.diagrams.length })}</div>
            )}
            {preview.impact.referrers.length > 0 && (
              <div className="text-[#8A6D1F]">
                {t("impactReferrers", { refs: preview.impact.referrers.map((r) => pathLabel(r.path)).join(", ") })}
              </div>
            )}
          </div>
        )}

        {needsReason && !empty && (
          <div className="flex flex-col gap-1.5">
            <p className="text-body text-[#554DB0] bg-[#F2F1FB] rounded-[10px] px-3 py-2">
              {t("baselineNote")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="cr-requester" className="text-caption font-extrabold text-[#8A867E] tracking-wider uppercase">
                  {t("requester")}
                </label>
                <input
                  id="cr-requester"
                  value={requester}
                  onChange={(e) => setRequester(e.target.value)}
                  maxLength={120}
                  placeholder={t("requesterPlaceholder")}
                  className="w-full px-3 py-2 rounded-[10px] border-[1.5px] border-[#E4E1DC] bg-[#FAF9F7] text-body outline-none focus:border-[#6A62C4]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cr-source" className="text-caption font-extrabold text-[#8A867E] tracking-wider uppercase">
                  {t("source")}
                </label>
                <select
                  id="cr-source"
                  value={sourceKind}
                  onChange={(e) => setSourceKind(e.target.value as ChangeRequestInfo["source"]["kind"] | "")}
                  className="w-full px-3 py-2 rounded-[10px] border-[1.5px] border-[#E4E1DC] bg-[#FAF9F7] text-body outline-none focus:border-[#6A62C4]"
                >
                  <option value="">{t("sourcePick")}</option>
                  {CR_SOURCE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {crSource(kind)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label htmlFor="cr-source-ref" className="text-caption font-extrabold text-[#8A867E] tracking-wider uppercase">
              {t("sourceRef")}
            </label>
            <input
              id="cr-source-ref"
              value={sourceRef}
              onChange={(e) => setSourceRef(e.target.value)}
              maxLength={300}
              placeholder={t("sourceRefPlaceholder")}
              className="w-full px-3 py-2 rounded-[10px] border-[1.5px] border-[#E4E1DC] bg-[#FAF9F7] text-body outline-none focus:border-[#6A62C4]"
            />
            <label htmlFor="change-reason" className="text-caption font-extrabold text-[#8A867E] tracking-wider uppercase">
              {t("reason")}
            </label>
            <textarea
              id="change-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              className="w-full px-3 py-2 rounded-[10px] border-[1.5px] border-[#E4E1DC] bg-[#FAF9F7] text-body outline-none resize-none focus:border-[#6A62C4]"
            />
            <span className="text-caption text-[#8A867E]">{t("reasonNote")}</span>
          </div>
        )}

        {note && <p className="text-body text-[#554DB0] bg-[#F2F1FB] rounded-[10px] px-3 py-2">{note}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3.5 py-1.5 rounded-full text-body font-bold border border-[#ECEAE5] text-[#4B4842] hover:bg-[#FAF9F7] cursor-pointer disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          {!empty && (
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => onConfirm(needsReason ? reason.trim() : undefined, changeRequest())}
              className="px-3.5 py-1.5 rounded-full text-body font-bold bg-[#191817] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? (busyLabel ?? t("applying")) : preview.no_change && !confirmWhenInvalid ? t("confirmNoChange") : (confirmLabel ?? t("confirm"))}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
