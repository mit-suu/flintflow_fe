import type { Flag } from "@/types/flags";
import { isOpenFlag } from "@/types/flags";
import type { PendingItem } from "@/types/pending-queue";
import type { Spine } from "@/types/spine";
import type { Locale } from "@/lib/i18n";
import { assumptionText } from "../brief-labels";
import { readableMessage } from "../flag-rules";
import { CHOICES, type ChoiceDef, type ChoiceTarget } from "./resolve-queue-actions";

/** Translator của namespace `workspace.resolveQueue` dạng lỏng (key động theo loại việc / lựa chọn). */
export type ResolveQueueT = (key: string, values?: Record<string, string | number>) => string;

/** Một việc đã dựng chữ từ Spine + cờ đã tải. BE chỉ trả danh tính, không trả chữ. */
export interface ItemView extends ChoiceTarget {
  key: string;
  item: PendingItem;
  kindLabel: string;
  /** Câu cần quyết. */
  question: string;
  /** Nội dung ngắn nói việc này về cái gì - dùng cho dòng chat sau khi quyết. */
  subject: string;
  /** Câu trích từ Spine (giả định, nội dung ghi chú, mô tả màn, các lưu ý của nhóm). */
  quoteLines: string[];
  /** Dòng phụ nhỏ hơn câu trích (lý do của giả định). */
  detail: string | null;
  sectionId: string | null;
  sectionName: string | null;
  /** Nhóm đã bấm "sửa cả nhóm trong chat" mà vẫn còn lưu ý. */
  leftAfterChat: boolean;
  choices: ChoiceDef[];
}

export interface ViewContext {
  spine: Spine;
  flags: readonly Flag[];
  locale: Locale;
  t: ResolveQueueT;
  sectionName: (sectionId: string) => string | undefined;
  /** Nhóm cờ vàng đã gửi sang chat sửa trong phiên này. */
  editedGroups: ReadonlySet<string>;
}

const MAX_GROUP_LINES = 3;

/** `null` khi phần tử mà việc trỏ tới không còn trong Spine / cờ đã tải (lệch phiên bản) ⇒ bỏ khỏi dãy, không dựng thẻ rỗng. */
export function buildItemView(item: PendingItem, ctx: ViewContext): ItemView | null {
  const { spine, flags, locale, t } = ctx;
  const sectionId = item.section_id;
  const sectionName = sectionId ? (ctx.sectionName(sectionId) ?? null) : null;
  const base = {
    key: item.key,
    item,
    kind: item.kind,
    kindLabel: t(`kind.${item.kind}`),
    sectionId,
    sectionName,
    leftAfterChat: false,
    detail: null as string | null,
    flagIds: [] as string[],
    prefill: "",
  };
  const choices = CHOICES[item.kind];

  switch (item.kind) {
    case "assumption": {
      const a = spine.assumptions.find((x) => x.id === item.refs.assumption_id);
      if (!a) return null;
      const why = (locale === "vi" && a.rationale_vi) || a.rationale || a.rationale_vi || null;
      return { ...base, entityId: a.id, subject: assumptionText(a, locale), question: t("question.assumption"), quoteLines: [assumptionText(a, locale)], detail: why, choices };
    }
    case "brief_note": {
      const n = spine.addendum.find((x) => x.id === item.refs.addendum_id);
      if (!n) return null;
      return { ...base, entityId: n.id, subject: n.content, question: t("question.brief_note"), quoteLines: [n.content], choices };
    }
    case "screen": {
      const s = spine.screens.find((x) => x.id === item.refs.screen_id);
      if (!s) return null;
      return {
        ...base,
        entityId: s.id,
        subject: s.name,
        question: t("question.screen", { name: s.name }),
        quoteLines: s.description ? [s.description] : [],
        choices,
      };
    }
    case "flag_red": {
      const f = flags.find((x) => x.id === item.refs.flag_ids?.[0]);
      if (!f) return null;
      const issue = readableMessage(f.message, f.section_id, ctx.sectionName(f.section_id));
      return {
        ...base,
        entityId: f.id,
        subject: issue,
        flagIds: [f.id],
        question: issue,
        quoteLines: [],
        prefill: t("prefill.flag", { label: sectionName ?? ctx.sectionName(f.section_id) ?? "", issue }),
        choices,
      };
    }
    case "flag_yellow_group": {
      const group = (item.refs.flag_ids ?? []).map((id) => flags.find((f) => f.id === id)).filter((f): f is Flag => f !== undefined && isOpenFlag(f));
      if (group.length === 0) return null;
      const messages = group.map((f) => readableMessage(f.message, f.section_id, ctx.sectionName(f.section_id)));
      const leftAfterChat = ctx.editedGroups.has(item.key);
      return {
        ...base,
        entityId: item.key,
        subject: messages[0],
        flagIds: group.map((f) => f.id),
        question: leftAfterChat ? t("question.groupLeft", { count: group.length }) : t("question.group", { count: group.length }),
        quoteLines: messages.slice(0, MAX_GROUP_LINES).concat(messages.length > MAX_GROUP_LINES ? [t("moreLines", { count: messages.length - MAX_GROUP_LINES })] : []),
        prefill: t("prefill.group", { issues: messages.join("; ") }),
        leftAfterChat,
        // Đã nhờ AI sửa cả nhóm mà còn sót ⇒ không mời AI sửa lại (tốn credit lần nữa), chỉ còn bỏ qua
        choices: leftAfterChat ? choices.filter((c) => !c.handoff) : choices,
      };
    }
  }
}

/** Rút gọn câu trích cho dòng chat. */
export const shortText = (text: string, max = 80): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}...` : flat;
};
