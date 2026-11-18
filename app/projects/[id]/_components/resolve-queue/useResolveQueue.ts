"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { estimateActionCost } from "@/lib/api/chat";
import type { Flag } from "@/types/flags";
import type { PendingItem, PendingQueue } from "@/types/pending-queue";
import type { Spine } from "@/types/spine";
import type { Locale } from "@/lib/i18n";
import {
  WAIVE_REASON_MIN_LENGTH,
  executeChoice,
  type ChoiceCreditAction,
  type ResolveQueueHandlers,
} from "./resolve-queue-actions";
import { pruneKeys, readQueueMemory, writeQueueMemory } from "./resolve-queue-storage";
import { buildItemView, shortText, type ItemView, type ResolveQueueT } from "./resolve-queue-view";

/** `closed`: chỉ có dải; `queue`: đi lần lượt; `single`: một việc lẻ mở từ tab; `afterSingle`: hỏi tiếp lần lượt hay để sau. */
export type QueuePhase = "closed" | "queue" | "single" | "afterSingle";

export interface UseResolveQueueArgs {
  projectId: string;
  queue: PendingQueue | null;
  loading: boolean;
  reloadQueue: () => Promise<PendingQueue | null>;
  spine: Spine | null;
  flags: readonly Flag[];
  /** Chế độ 2-4, được sửa, phiên pipeline - sai một điều kiện là không hiện gì. */
  enabled: boolean;
  /** AI đang chạy: thẻ thu một dòng và không handler nào chạy. */
  locked: boolean;
  /** AI đang hỏi / thẻ duyệt đang mở: thẻ nhường chỗ, giữ vị trí. */
  yielded: boolean;
  /** Id giả định / cờ đang nằm trong thẻ duyệt đang mở - lọc khỏi hàng. */
  excludeIds?: ReadonlySet<string>;
  sectionName: (sectionId: string) => string | undefined;
  handlers: ResolveQueueHandlers;
}

export interface AlsoDone {
  count: number;
  labels: string[];
}

export interface ResolveQueueController {
  /** Có gì để vẽ không (dải hoặc thẻ). */
  visible: boolean;
  locked: boolean;
  phase: QueuePhase;
  /** Việc chưa quyết (kể cả đã để sau). */
  total: number;
  /** Khoá các việc còn chờ thật (đã bỏ việc đã xem "Giữ" / "Đặc tả vòng này" và việc của thẻ duyệt đang mở) - tab Chờ quyết lọc theo đây để khớp dải. */
  pendingKeys: ReadonlySet<string>;
  /** Việc chưa quyết và chưa để sau. */
  activeCount: number;
  /** Số việc đã quyết trong lượt đi hiện tại - cho thanh tiến độ. */
  resolved: number;
  current: ItemView | null;
  /** Credit ước tính của thao tác AI trên việc hiện tại; `null` = chưa biết / không có. */
  credit: number | null;
  busy: boolean;
  error: string | null;
  alsoDone: AlsoDone | null;
  open: () => void;
  /** Mở một việc lẻ (tab Chờ quyết): xong thì hỏi tiếp lần lượt hay để sau. */
  openItem: (key: string) => void;
  collapse: () => void;
  later: () => void;
  reviewLater: () => void;
  continueQueue: () => void;
  choose: (choiceId: string, input?: string) => Promise<void>;
}

const isExcluded = (item: PendingItem, exclude: ReadonlySet<string> | undefined): boolean =>
  exclude !== undefined &&
  exclude.size > 0 &&
  ((item.refs.assumption_id !== undefined && exclude.has(item.refs.assumption_id)) || (item.refs.flag_ids ?? []).some((id) => exclude.has(id)));

const withKey = (set: ReadonlySet<string>, key: string): Set<string> => new Set(set).add(key);

export function useResolveQueue(args: UseResolveQueueArgs): ResolveQueueController {
  const { projectId, queue, loading, reloadQueue, spine, flags, enabled, locked, yielded, excludeIds, sectionName, handlers } = args;
  const tRaw = useTranslations("workspace.resolveQueue");
  const t = tRaw as unknown as ResolveQueueT;
  const locale = useLocale() as Locale;

  const [seen, setSeen] = useState<ReadonlySet<string>>(() => readQueueMemory("seen", projectId));
  const [deferred, setDeferred] = useState<ReadonlySet<string>>(() => readQueueMemory("later", projectId));
  const [editedGroups, setEditedGroups] = useState<ReadonlySet<string>>(new Set());
  const [phase, setPhase] = useState<QueuePhase>("closed");
  const [singleKey, setSingleKey] = useState<string | null>(null);
  const [resolved, setResolved] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [alsoDone, setAlsoDone] = useState<AlsoDone | null>(null);
  const [costs, setCosts] = useState<Partial<Record<ChoiceCreditAction, number>>>({});
  const [prunedFor, setPrunedFor] = useState<PendingQueue | null>(null);

  // Dọn key không còn trong hàng mỗi lần hàng mới về (ghi chú đã bỏ, cờ đã đóng...) - tính ngay lúc render như `page.tsx`
  if (queue !== null && prunedFor !== queue) {
    setPrunedFor(queue);
    const alive = new Set(queue.items.map((item) => item.key));
    setSeen((prev) => pruneKeys(prev, alive));
    setDeferred((prev) => pruneKeys(prev, alive));
  }
  useEffect(() => writeQueueMemory("seen", projectId, seen), [projectId, seen]);
  useEffect(() => writeQueueMemory("later", projectId, deferred), [projectId, deferred]);

  const ready = enabled && queue !== null && spine !== null;
  const views: ItemView[] =
    ready && spine
      ? queue.items.flatMap((item) => {
          if (seen.has(item.key) || isExcluded(item, excludeIds)) return [];
          const view = buildItemView(item, { spine, flags, locale, t, sectionName, editedGroups });
          return view ? [view] : [];
        })
      : [];
  const active = views.filter((view) => !deferred.has(view.key));
  const pendingKeys: ReadonlySet<string> = new Set(views.map((view) => view.key));
  const current: ItemView | null =
    phase === "queue" ? (active[0] ?? null) : phase === "single" ? (views.find((view) => view.key === singleKey) ?? null) : null;

  // Chuyển pha theo dữ liệu (không đoán bằng sự kiện): hết việc ⇒ về dải; việc lẻ đã xong ⇒ hỏi tiếp
  if (ready && !loading) {
    if (phase === "queue" && active.length === 0) setPhase("closed");
    else if (phase === "single" && current === null) setPhase(views.length > 0 ? "afterSingle" : "closed");
    else if (phase === "afterSingle" && views.length === 0) setPhase("closed");
  }

  const creditAction = current?.choices.find((c) => c.credit !== null)?.credit ?? null;
  const requestedCosts = useRef(new Set<ChoiceCreditAction>());
  useEffect(() => {
    if (!creditAction || requestedCosts.current.has(creditAction)) return;
    requestedCosts.current.add(creditAction);
    estimateActionCost(creditAction)
      .then((res) => {
        const cost = res.data?.cost;
        if (typeof cost === "number") setCosts((prev) => ({ ...prev, [creditAction]: cost }));
      })
      .catch(() => requestedCosts.current.delete(creditAction));
  }, [creditAction]);

  // Cổng chặn thật sự nằm ở đây, không chỉ ở UI: ref luôn là giá trị mới nhất kể cả khi sự kiện bấm đến giữa hai lần render
  const guard = useRef({ locked, yielded });
  useEffect(() => {
    guard.current = { locked, yielded };
  }, [locked, yielded]);
  const busyRef = useRef(false);

  const open = useCallback(() => {
    if (guard.current.locked) return;
    setResolved(0);
    setAlsoDone(null);
    setPhase("queue");
  }, []);

  // Không bọc useCallback: đọc `views` dựng lại mỗi lần render (phụ thuộc Spine + cờ), bọc cũng không giữ được tham chiếu
  const openItem = (key: string) => {
    if (guard.current.locked || !views.some((view) => view.key === key)) return;
    setAlsoDone(null);
    setSingleKey(key);
    setPhase("single");
  };

  /** Đọc khoá lúc chạy (giữa chuỗi ghi), không theo giá trị lúc bấm. */
  const isLocked = useCallback(() => guard.current.locked, []);

  const collapse = useCallback(() => {
    setAlsoDone(null);
    setPhase("closed");
  }, []);

  const later = useCallback(() => {
    if (guard.current.locked || busyRef.current || !current) return;
    setAlsoDone(null);
    setDeferred((prev) => withKey(prev, current.key));
    if (phase === "single") setPhase("closed");
  }, [current, phase]);

  const reviewLater = useCallback(() => {
    if (guard.current.locked) return;
    setDeferred(new Set());
    setResolved(0);
    setPhase("queue");
  }, []);

  const continueQueue = useCallback(() => {
    if (guard.current.locked) return;
    setPhase("queue");
  }, []);

  const choose = async (choiceId: string, input = ""): Promise<void> => {
    const view = current;
    if (!view || guard.current.locked || guard.current.yielded || busyRef.current) return;
    const choice = view.choices.find((c) => c.id === choiceId);
    if (!choice) return;
    if (choice.input === "text" && !input.trim()) return;
    if (choice.input === "reason" && input.trim().length < WAIVE_REASON_MIN_LENGTH) {
      setFailure({ key: view.key, message: t("errors.reasonShort", { min: WAIVE_REASON_MIN_LENGTH }) });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setFailure(null);
    setAlsoDone(null);
    const before = views;
    try {
      const outcome = await executeChoice(view, choiceId, input, { ...handlers, isLocked });

      if (outcome.status === "handoff") {
        // Việc quyết xong ở chat: thẻ nhường chỗ, việc nằm lại hàng cho tới khi cờ thật sự đóng
        setDeferred((prev) => withKey(prev, view.key));
        if (view.kind === "flag_yellow_group") setEditedGroups((prev) => withKey(prev, view.key));
        setPhase("closed");
        return;
      }
      if (outcome.status === "failed") {
        setFailure({ key: view.key, message: outcome.message ?? t(choice.handoff ? "errors.chatBlocked" : "errors.write") });
        return;
      }
      if (outcome.status === "partial") {
        handlers.postChatLine(t("partialLine", { done: outcome.done, total: outcome.total }));
        setFailure({ key: view.key, message: t("errors.partial", { done: outcome.done, total: outcome.total, message: outcome.stoppedByAi ? t("errors.pausedByAi") : (outcome.message ?? t("errors.write")) }) });
        void reloadQueue();
        return;
      }

      if (outcome.markSeen) setSeen((prev) => withKey(prev, view.key));
      handlers.postChatLine(
        t("chatLine", {
          kind: view.kindLabel,
          text: shortText(view.subject),
          choice: t(`result.${view.kind}.${choiceId}`, { done: outcome.done ?? 0, total: outcome.total ?? 0 }),
        })
      );
      setResolved((n) => n + 1);
      const next = await reloadQueue();
      if (next) {
        // Quyết việc này kéo theo việc khác biến mất khỏi hàng ⇒ nói cho người dùng biết
        const nextKeys = new Set(next.items.map((item) => item.key));
        const gone = before.filter((other) => other.key !== view.key && !nextKeys.has(other.key));
        if (gone.length > 0) setAlsoDone({ count: gone.length, labels: gone.map((g) => shortText(g.subject, 60)) });
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return {
    visible: enabled && !yielded && ready && views.length > 0,
    locked,
    phase,
    total: views.length,
    pendingKeys,
    activeCount: active.length,
    resolved,
    current,
    credit: creditAction ? (costs[creditAction] ?? null) : null,
    busy,
    error: failure && failure.key === current?.key ? failure.message : null,
    alsoDone,
    open,
    openItem,
    collapse,
    later,
    reviewLater,
    continueQueue,
    choose,
  };
}
