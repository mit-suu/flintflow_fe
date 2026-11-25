"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addCrMaterialFile,
  addCrMaterialText,
  answerClarifications,
  cancelCr,
  createCr,
  deleteCrMaterial,
  draftInOwnerStep,
  getCr,
  listCrs,
  patchLocation,
  revertCr,
  runCrAction,
  sendCrMessage,
  type CrAction,
} from "@/lib/api/change-requests";
import { ApiClientError } from "@/lib/api/client";
import { getReviewPackage } from "@/lib/api/versions";
import {
  CR_AMENDABLE_STATUSES,
  CR_OPEN_STATUSES,
  CR_REDRAFT_STATUSES,
  KEEPABLE_VIOLATION_RULES,
  type CreateCrRequest,
  type CrDetail,
  type CrLocation,
  type CrOwnOpenMeta,
  type NEW_CR_SOURCE_KINDS,
} from "@/types/change-request";
import { useErrorText } from "../../_components/mode1/i18n";
import { answersWithdraw } from "@/lib/withdrawal";

/** Nguồn + người yêu cầu chọn ở thẻ 3.1 trong chat. */
export interface CrChatSource {
  kind: (typeof NEW_CR_SOURCE_KINDS)[number];
  requester: string;
  ref?: string | null;
}

/**
 * FLF-375 — CR chỉ tạo bằng chat: lối vào khác (gap report, comment, cờ, bản xem trước, re-upload) mở khung chat với câu
 * yêu cầu trong ô chat + nguồn điền sẵn ở đây; thẻ chọn nguồn (C-1) mở sẵn đúng nguồn / tham chiếu / người yêu cầu.
 */
export interface CrChatPrefill {
  kind?: (typeof NEW_CR_SOURCE_KINDS)[number];
  ref?: string;
  requester?: string;
  previewId?: string;
  commentId?: string;
}

/** Việc đang chạy — để luồng chat nói "AI đang …". */
export type CrChatBusy = "create" | CrAction | "amend" | "answers" | "material" | "reject" | "redraft" | "cancel" | "revert" | "decide";

/** Đề xuất đã đổi (AI làm lại / soạn lại) ⇒ khoá khác ⇒ người dùng phải đồng ý lại. */
export const proposalKey = (l: CrLocation): string =>
  `${l.location_id}|${l.conclusion ?? ""}|${l.proposal?.new_text ?? ""}|${l.proposal?.comment_text ?? ""}|${JSON.stringify(l.proposal?.spine_ops ?? [])}`;

/** Cùng luật `needsProposal` BE: chưa kết luận, hoặc kiểm trượt mà không phải sửa tay. */
const needsProposal = (l: CrLocation): boolean => !l.manual && (l.conclusion === null || (l.verify !== null && !l.verify.code_ok));

/** Vị trí trượt kiểm (3.7) mà người dùng chưa soạn lại / bỏ — soạn lại hoặc bỏ đều xoá kết quả kiểm cũ. */
export const isFailing = (l: CrLocation): boolean => l.verify !== null && !l.verify.code_ok;

/** Cùng luật `hasOpenConflict` BE: người khác đã sửa chỗ này mà người dùng chưa quyết (còn đề xuất sửa) ⇒ không tự kiểm / soạn lại. */
export const hasOpenConflict = (l: CrLocation): boolean => !!l.conflict && l.conclusion === "edit";

/**
 * FLF-318: CR mang lô người dùng đã duyệt ở bản xem trước (thêm / xoá / sửa use case), chưa gộp thêm lệnh — BE làm đúng lô
 * đó, không hỏi / không gọi AI ⇒ không bắt duyệt lại từng phần như trước baseline: đề xuất của lô tính là đã đồng ý.
 */
export const fromApprovedPreview = (d: CrDetail): boolean => (d.change_request.seed?.ops.length ?? 0) > 0 && d.change_request.amendments.length === 0;

/**
 * FLF-375: chỗ thuộc đúng lô người dùng đã duyệt ở bản xem trước — chỉ những chỗ này tính là đã đồng ý. Chỗ khác của CR
 * (văn xuôi còn nhắc phần tử vừa xoá, sơ đồ gốc vẽ lại…) là đề xuất mới của AI ⇒ người dùng phải quyết (BF C-4, C-6).
 */
export const inApprovedBatch = (d: CrDetail, l: CrLocation): boolean => fromApprovedPreview(d) && l.found_by.includes("preview") && !isFailing(l);

/**
 * C-4: AI cảnh báo yêu cầu ở chỗ này và BA chưa chọn - chặn Gửi duyệt tới khi "Vẫn làm" hoặc bỏ chỗ này (BE `CR_WARNING_PENDING`).
 * Chỗ đã bỏ (`not_related`) hay đã "Vẫn làm" (`kept_intent`) thì không còn chờ.
 */
export const isWarningPending = (l: CrLocation): boolean => !!l.warning && !l.kept_intent && l.conclusion !== "not_related";

/**
 * C-5: "Giữ theo ý mình" chỉ cho CR `manual_fix`, chỗ trượt kiểm mà MỌI lỗi là lỗi luật cờ đỏ mới. Lỗi "chữ cũ không còn khớp"
 * (`value_changed`), thiếu / sai cấu trúc thì không giữ được (BE `CR_CANNOT_KEEP`).
 */
export const canKeepViolations = (d: CrDetail, l: CrLocation): boolean => {
  const violations = l.verify?.violations ?? [];
  return d.change_request.status === "manual_fix" && !!l.verify && !l.verify.code_ok && violations.length > 0 && violations.every((v) => KEEPABLE_VIOLATION_RULES.includes(v.rule));
};

/**
 * CR chưa nộp mới nhất của chính `myUserId` (danh sách BE trả mới nhất trước) - `null` nếu không có. FLF-449: `preferCr`
 * (CR vừa tạo từ danh sách rút / "Mở trong khung chat") được ưu tiên nếu nó còn mở.
 */
const fetchOwnOpenCr = async (projectId: string, myUserId: string, preferCr?: string | null): Promise<CrDetail | null> => {
  const res = await listCrs(projectId);
  const mineOpen = (res.data ?? []).filter((c) => CR_OPEN_STATUSES.includes(c.status) && c.created_by === myUserId);
  const open = mineOpen.find((c) => c.cr_id === preferCr) ?? mineOpen[0];
  if (!open) return null;
  return (await getCr(projectId, open.cr_id)).data;
};

const storageKey = (projectId: string, crId: string, what: "accepted" | "impact") => `ff-cr-chat:${projectId}:${crId}:${what}`;
const readStore = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (key: string, value: string | null): void => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* chế độ riêng tư / chặn lưu — chỉ mất tiện ích nhớ, luồng vẫn chạy */
  }
};

const EMPTY: ReadonlySet<string> = new Set();

/** Tiêu đề CR từ lệnh sửa đầu tiên: dòng đầu, ≤ 120 ký tự. */
export const titleFromInstruction = (instruction: string): string => {
  const line = instruction.trim().split(/\r?\n/)[0] ?? "";
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
};

/**
 * Mode 1 v3 phase 8 — change request chạy trong khung chat. Lệnh sửa đầu tiên mở CR (sau khi chọn nguồn + người yêu
 * cầu, BPMN 3.1); lệnh sau gộp vào CR đang mở (`/amend`). Bước AI không cần người (làm rõ, tìm vị trí, đề xuất, kiểm)
 * tự chạy tiếp; dừng ở câu hỏi, danh sách phần liên quan, đề xuất chưa được đồng ý, lỗi / hết credit, và "Gửi cho Lead".
 * Mọi trạng thái lấy từ `CrDetail` BE trả — hook chỉ nhớ thêm (localStorage) đề xuất nào người dùng đã đồng ý.
 */
/**
 * `myUserId`: BF §3.2 / spec UC-45 A6 — khung chat chỉ nhận **CR mở của chính mình**. CR của người khác treo ở người đó
 * (họ thấy dòng "<ai> có bản sửa chưa xác nhận" trong tài liệu), lệnh sửa của mình mở CR mới chứ không gộp vào CR của họ.
 */
export function useCrChat(projectId: string, enabled = true, onWritten?: (crId: string, flagIds: string[]) => void, myUserId: string | null = null) {
  // Chỉ dùng trong callback (`send`) và lúc render (`inputHint`) — không nằm trong effect tải dữ liệu
  const t = useTranslations("mode1.crChat");
  const errorText = useErrorText();
  const [detail, setDetail] = useState<CrDetail | null>(null);
  const [loading, setLoading] = useState(enabled);
  /** Lệnh sửa đầu tiên đang chờ chọn nguồn + người yêu cầu. */
  const [pending, setPending] = useState<string | null>(null);
  /**
   * FLF-318: lệnh thêm / xoá use case đã đi xong vòng hỏi đáp + bản xem trước như trước baseline ⇒ CR mang bản xem trước đó
   * (`preview_id`, BE dùng đúng lô người dùng đã duyệt) và cả đoạn hỏi đáp làm mô tả.
   */
  const [pendingSeed, setPendingSeed] = useState<{ previewId: string; description: string } | null>(null);
  const [prefill, setPrefill] = useState<CrChatPrefill | null>(null);
  /** CR vừa ghi vào bản nháp — hiện thẻ xác nhận cho tới lệnh sửa kế tiếp (mọi lệnh: thêm / sửa / xoá, kể cả use case). */
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState<CrChatBusy | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 409 `CR_OWN_OPEN`: người này còn CR dở - `crId` là mã BE báo (`null` => tự tìm trong danh sách). Đi kèm `error`. */
  const [ownOpen, setOwnOpen] = useState<{ crId: string | null } | null>(null);
  /** Vị trí đang chờ người dùng gõ hướng "Sửa lại". */
  const [redraftFor, setRedraftFor] = useState<string | null>(null);
  /** FLF-375: câu hỏi giữa chừng + câu AI trả lời (chỉ trong phiên xem, không ghi vào CR). */
  /** UC-46 / AC-43.3: gói đang chờ Lead duyệt ⇒ bản nháp khoá, không mở CR mới (báo ngay thay vì chờ BE trả 409). */
  const [draftLocked, setDraftLocked] = useState(false);
  const [replies, setReplies] = useState<{ question: string; reply: string }[]>([]);
  /**
   * FLF-439: câu trả lời làm rõ là lời rút lại ("không đổi nữa", "thôi khỏi") ⇒ chưa gửi, hỏi "huỷ CR?" — giữ các câu trả lời
   * để "Gửi như câu trả lời" khi người dùng thật ra đang trả lời. Không tự huỷ: huỷ CR không quay lại được.
   */
  const [withdrawAsk, setWithdrawAsk] = useState<string[] | null>(null);
  /**
   * Câu trả lời ĐÃ gửi mà AI đọc là lời rút lại (`withdraw_suggested`, câu luật trên không bắt được) ⇒ dừng, chưa tự chạy
   * bước kế; giữ chi tiết CR để "Gửi như câu trả lời" chỉ việc đi tiếp, không gửi lại.
   */
  const [withdrawSent, setWithdrawSent] = useState<CrDetail | null>(null);
  /** Đề xuất người dùng đã đồng ý, theo CR (khởi tạo từ localStorage khi mở CR). */
  const [acceptedByCr, setAcceptedByCr] = useState<Readonly<Record<string, ReadonlySet<string>>>>({});
  const alive = useRef(true);
  const sendingRef = useRef(false);
  // CR vừa ghi bản nháp ⇒ trang tải lại Spine / tài liệu / version (giữ hàm mới nhất, không làm đổi `submit`)
  const onWrittenRef = useRef(onWritten);
  useEffect(() => {
    onWrittenRef.current = onWritten;
  }, [onWritten]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const crId = detail?.change_request.cr_id ?? null;

  // Đồng ý của CR đang mở: đã chọn trong phiên này, không thì đọc lại từ localStorage
  const accepted = useMemo<ReadonlySet<string>>(() => {
    if (!crId) return EMPTY;
    if (acceptedByCr[crId]) return acceptedByCr[crId];
    try {
      const raw = readStore(storageKey(projectId, crId, "accepted"));
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return EMPTY;
    }
  }, [acceptedByCr, crId, projectId]);

  const saveAccepted = useCallback(
    (id: string, next: ReadonlySet<string>) => {
      setAcceptedByCr((prev) => ({ ...prev, [id]: next }));
      writeStore(storageKey(projectId, id, "accepted"), JSON.stringify([...next]));
    },
    [projectId]
  );

  // CR đang mở = CR chưa nộp mới nhất **của mình** (danh sách BE trả mới nhất trước). `reloadSeq` / `preferCr` (E2E 24/11 #3):
  // duyệt danh sách rút tạo CR mới, hay bấm "Mở trong khung chat" ở một CR cụ thể ⇒ nạp lại, ưu tiên CR được chỉ định nếu nó
  // là CR đang mở của mình.
  const [reloadSeq, setReloadSeq] = useState(0);
  const [preferCr, setPreferCr] = useState<string | null>(null);
  useEffect(() => {
    // Chưa biết mình là ai ⇒ chờ, không nhận nhầm CR của người khác
    if (!enabled || !myUserId) return;
    let cancelled = false;
    getReviewPackage(projectId)
      .then((r) => !cancelled && alive.current && setDraftLocked(r.data?.status === "pending"))
      .catch(() => undefined);
    fetchOwnOpenCr(projectId, myUserId, preferCr)
      .then((full) => {
        if (!cancelled && alive.current && full) setDetail(full);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && alive.current && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, enabled, myUserId, reloadSeq, preferCr]);
  const reloadOpen = useCallback((prefer?: string | null) => {
    if (prefer !== undefined) setPreferCr(prefer);
    setReloadSeq((n) => n + 1);
  }, []);

  /**
   * FLF-480 (B17): đọc lại CR đang mở. Tải lại trang lúc BE còn đang ghi ("Xác nhận & ghi") nạp CR ở `ready_to_submit`; BE ghi xong
   * thành `written` nhưng chat không biết ⇒ vẫn "Sẵn sàng nộp", lệnh mới gộp vào CR cũ. Trả CR mới đọc được (`null` = CR đã đóng,
   * hoặc không đọc được ⇒ giữ nguyên trạng thái hiện có).
   */
  const detailRef = useRef(detail);
  const busyRef = useRef<CrChatBusy | null>(null);
  useEffect(() => {
    detailRef.current = detail;
    busyRef.current = busy;
  }, [detail, busy]);
  const refreshOpen = useCallback(async (): Promise<CrDetail | null | undefined> => {
    const cur = detailRef.current;
    if (!cur) return undefined;
    let fresh: CrDetail | null;
    try {
      fresh = (await getCr(projectId, cur.change_request.cr_id)).data ?? null;
    } catch {
      return undefined;
    }
    if (!alive.current || detailRef.current?.change_request.cr_id !== cur.change_request.cr_id) return undefined;
    if (!fresh) return undefined;
    if (CR_OPEN_STATUSES.includes(fresh.change_request.status)) {
      if (fresh.change_request.status !== cur.change_request.status || fresh.change_request.updated_at !== cur.change_request.updated_at) setDetail(fresh);
      return fresh;
    }
    // CR đã ghi / huỷ / nộp ở nơi khác ⇒ thôi coi là CR mở; ghi vào bản nháp thì báo trang tải lại tài liệu như lúc tự xác nhận
    setDetail(null);
    setRedraftFor(null);
    if (fresh.change_request.status === "written") {
      setSent(fresh.change_request.cr_id);
      onWrittenRef.current?.(fresh.change_request.cr_id, cur.change_request.flag_ids ?? []);
    }
    return null;
  }, [projectId]);

  // CR đang ở bước BE có thể đang ghi (`ready_to_submit` / `verifying`) và không phải do lượt chạy này đang chờ ⇒ đọc lại sau vài
  // giây (vài lần) và mỗi khi cửa sổ được focus
  const watchedStatus = detail?.change_request.status;
  const watchedCr = detail?.change_request.cr_id ?? null;
  useEffect(() => {
    if (!enabled || !watchedCr || (watchedStatus !== "ready_to_submit" && watchedStatus !== "verifying")) return;
    const check = () => {
      if (!sendingRef.current && !busyRef.current) void refreshOpen();
    };
    let tries = 0;
    const timer = window.setInterval(() => {
      if (++tries > 6) return window.clearInterval(timer);
      check();
    }, 4000);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [enabled, watchedCr, watchedStatus, refreshOpen]);

  const isAccepted = useCallback(
    (l: CrLocation) => accepted.has(proposalKey(l)) || (detail !== null && inApprovedBatch(detail, l)),
    [accepted, detail]
  );

  /** Mọi vị trí đã có kết luận và mọi đề xuất sửa / comment đã được người dùng đồng ý (lô đã duyệt ở bản xem trước ⇒ đồng ý sẵn). */
  const allDecided = useCallback(
    (d: CrDetail, set: ReadonlySet<string> = accepted) =>
      d.locations.length > 0 &&
      d.locations.every((l) => l.conclusion !== null && (l.conclusion === "not_related" || set.has(proposalKey(l)) || inApprovedBatch(d, l))),
    [accepted]
  );

  const needImpact = useCallback(
    (d: CrDetail) =>
      d.change_request.status === "impact_review" &&
      (d.locations.length === 0 || readStore(storageKey(projectId, d.change_request.cr_id, "impact")) !== String(d.change_request.amendments.length)),
    [projectId]
  );

  /** Bước AI kế tiếp chạy được mà không cần người — `null` nếu đang chờ người dùng. */
  const nextAuto = useCallback(
    (d: CrDetail, set: ReadonlySet<string> = accepted, afterAnswer = false): CrAction | null => {
      const c = d.change_request;
      if (c.paused) return null;
      if (c.status === "draft" || c.status === "clarifying") return "clarify";
      if (needImpact(d)) return "impact";
      // P08 (CR #6): người dùng vừa trả lời câu làm rõ ⇒ đã quyết xong phần cần hỏi, chạy tiếp đề xuất luôn (không bắt bấm
      // "Tiếp tục - AI đề xuất sửa"); danh sách phần liên quan vẫn hiện trong chat
      // ... trừ khi BE báo ước tính credit (CR lớn): dừng để người dùng thấy số credit rồi tự bấm "Tiếp tục"
      if (afterAnswer && c.status === "impact_review" && d.locations.length > 0 && !d.propose_estimate) return "propose";
      // Lô đã duyệt ở bản xem trước: phần liên quan là đúng phần lô chạm tới ⇒ không dừng chờ "AI đề xuất sửa"
      if (c.status === "impact_review" && d.locations.length > 0 && fromApprovedPreview(d)) return "propose";
      if (c.status === "proposing" && d.locations.some(needsProposal)) return "propose";
      if ((c.status === "proposing" || c.status === "verifying") && allDecided(d, set)) return "verify";
      // 3.9: người dùng đã soạn lại / bỏ hết phần trượt và đồng ý mọi đề xuất ⇒ kiểm lại luôn
      // Còn chỗ xung đột với người khác (chưa quyết) ⇒ chờ người dùng, không tự kiểm (kiểm sẽ báo "đã đổi" rồi AI soạn lại đè phần người khác vừa sửa)
      if (c.status === "manual_fix" && allDecided(d, set) && !d.locations.some(isFailing) && !d.locations.some(hasOpenConflict)) return "verify";
      return null;
    },
    [accepted, allDecided, needImpact]
  );

  /** Chạy một lời gọi; lỗi ⇒ báo tiếng Việt và đọc lại CR (trạng thái có thể đã khác). */
  const call = useCallback(
    async <D extends CrDetail>(kind: CrChatBusy, fn: () => Promise<{ data: D | null }>): Promise<D | null> => {
      setBusy(kind);
      setError(null);
      setOwnOpen(null);
      try {
        const res = await fn();
        if (alive.current && res.data) setDetail(res.data);
        return res.data;
      } catch (err) {
        if (!alive.current) return null;
        setError(errorText(err));
        if (err instanceof ApiClientError && err.code === "CR_OWN_OPEN") {
          const id = (err.meta as Partial<CrOwnOpenMeta> | undefined)?.cr_id;
          setOwnOpen({ crId: typeof id === "string" ? id : null });
        }
        if (crId) void getCr(projectId, crId).then((r) => alive.current && r.data && setDetail(r.data)).catch(() => undefined);
        return null;
      } finally {
        if (alive.current) setBusy(null);
      }
    },
    [projectId, crId, errorText]
  );

  /**
   * Tự chạy các bước AI không cần người, dừng ở chỗ cần người dùng (tối đa 8 lượt). Cùng một bước hai lần liền (vd AI
   * đề xuất xong vẫn bỏ sót vị trí) ⇒ dừng để người dùng quyết, không gọi AI lặp tốn credit.
   */
  const advance = useCallback(
    async (start: CrDetail | null, set: ReadonlySet<string> = accepted, previous: CrAction | null = null, afterAnswer = false) => {
      let cur = start;
      let last = previous;
      for (let i = 0; cur && i < 8; i++) {
        const action = nextAuto(cur, set, afterAnswer);
        if (!action || action === last) return;
        last = action;
        const id = cur.change_request.cr_id;
        const amendments = cur.change_request.amendments.length;
        cur = await call(action, () => runCrAction(projectId, id, action));
        if (action === "impact" && cur) writeStore(storageKey(projectId, id, "impact"), String(amendments));
      }
    },
    [accepted, call, nextAuto, projectId]
  );

  /** 3.1 trong chat: người dùng chọn nguồn + người yêu cầu cho lệnh sửa đầu tiên ⇒ tạo CR ⇒ chạy tiếp. */
  const startCr = useCallback(
    async (source: CrChatSource) => {
      if (!pending) return;
      const instruction = pending;
      const seed = pendingSeed;
      const created = await call("create", () =>
        createCr(projectId, {
          title: titleFromInstruction(instruction),
          description: (seed?.description ?? instruction).slice(0, 5000),
          source: { kind: source.kind, ref: source.ref?.trim() || null, note: seed ? "Tạo từ bản xem trước trong khung chat" : "Tạo từ khung chat" },
          requester: source.requester.trim(),
          ...(seed ? { preview_id: seed.previewId } : prefill?.previewId ? { preview_id: prefill.previewId } : {}),
          ...(prefill?.commentId && source.kind === "viewer_comment" ? { comment_id: prefill.commentId } : {}),
        })
      );
      if (!created) return;
      setPending(null);
      setPendingSeed(null);
      setPrefill(null);
      setSent(null);
      await advance(created, new Set());
    },
    [advance, call, pending, pendingSeed, prefill, projectId]
  );

  const sendToCr = useCallback(
    async (detail: CrDetail, value: string) => {
      const c = detail.change_request;
      if (redraftFor) {
        const locId = redraftFor;
        const d = await call("redraft", () => draftInOwnerStep(projectId, c.cr_id, locId, { instruction: value }));
        if (d) {
          setRedraftFor(null);
          await advance(d);
        }
        return;
      }
      if (c.status === "awaiting_answers") {
        if (detail.pending_questions.length === 1) {
          if (answersWithdraw([value])) return setWithdrawAsk([value]);
          const d = await call("answers", () => answerClarifications(projectId, c.cr_id, [value]));
          if (d?.change_request.withdraw_suggested) {
            setWithdrawSent(d);
            return setWithdrawAsk([value]);
          }
          await advance(d, accepted, null, true);
        } else {
          setError(t("multiQuestion"));
        }
        return;
      }
      // FLF-375 (BF nguyên tắc 9): câu hỏi giữa chừng ("không vẽ lại hình à?") được AI trả lời, KHÔNG thành yêu cầu bổ sung;
      // lệnh sửa thì BE gộp vào CR như trước. BE phân loại bằng cùng luật với chat thường.
      if (c.paused) return setError(t("paused"));
      const r = await call("amend", () => sendCrMessage(projectId, c.cr_id, value));
      if (!r) return;
      if (r.message.kind === "answer") {
        const reply = r.message.reply;
        setReplies((prev) => [...prev, { question: value, reply }]);
        setDetail(r);
        return;
      }
      if (!CR_AMENDABLE_STATUSES.includes(c.status)) return setError(t("running"));
      await advance(r);
    },
    [accepted, advance, call, projectId, redraftFor, t]
  );

  /**
   * FLF-445: thẻ nhóm cờ ở hàng việc chờ quyết tạo thẳng một CR (nguồn và người yêu cầu đã chọn trên thẻ) rồi chạy tiếp
   * như CR mở từ chat. Không đi qua `pending`/`send` (thứ tự gửi của ô chat giữ nguyên). Lỗi BE ⇒ ném để thẻ hiện lỗi.
   */
  const startFromFlags = useCallback(
    async (req: Pick<CreateCrRequest, "title" | "description" | "source" | "requester"> & { flag_ids: string[] }): Promise<string> => {
      setBusy("create");
      setError(null);
      let created: CrDetail;
      try {
        const res = await createCr(projectId, {
          ...req,
          title: titleFromInstruction(req.title),
          description: req.description.slice(0, 5000),
          requester: req.requester.trim(),
        });
        if (!res.data) throw new Error(t("running"));
        created = res.data;
      } finally {
        // Trả `busy` trước khi chạy tiếp: `advance` tự đặt `busy` cho từng bước AI (đặt sau sẽ xoá mất trạng thái đang chạy)
        if (alive.current) setBusy(null);
      }
      if (alive.current) {
        setDetail(created);
        setPending(null);
        setPendingSeed(null);
        setPrefill(null);
        setSent(null);
      }
      // Chạy tiếp (làm rõ, tìm vị trí...) như CR mở từ chat; thẻ không chờ, khung chat hiện tiến trình
      void advance(created, new Set());
      return created.change_request.cr_id;
    },
    [advance, projectId, t]
  );

  /** Ô chat (chip "Sửa tài liệu" bật): định tuyến theo bước đang ở. */
  const send = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value) return;
      // FLF-480 (B17): trước khi gộp lệnh vào "CR đang mở", đọc lại trạng thái - CR có thể đã ghi / đóng ở nơi khác
      let current: CrDetail | null = detail;
      if (detail && !sendingRef.current) {
        sendingRef.current = true;
        try {
          const fresh = await refreshOpen();
          if (!alive.current) return;
          if (fresh === null) current = null;
          else if (fresh) current = fresh;
        } finally {
          sendingRef.current = false;
        }
      }
      if (!current) {
        setSent(null);
        // Đọc lại trạng thái gói ngay lúc gửi (người khác có thể vừa gửi Lead duyệt); không đọc được ⇒ để BE quyết
        const locked = await getReviewPackage(projectId)
          .then((r) => r.data?.status === "pending")
          .catch(() => false);
        if (!alive.current) return;
        setDraftLocked(locked);
        if (locked) {
          setError(t("draftLocked"));
          return;
        }
        setPending(value);
        return;
      }
      // FLF-400: lượt gửi trước vào CR chưa xong ⇒ bỏ qua, không gửi lần hai (`busy` là state, chậm một khung render)
      if (sendingRef.current) return;
      sendingRef.current = true;
      try {
        await sendToCr(current, value);
      } finally {
        sendingRef.current = false;
      }
    },
    [detail, sendToCr, refreshOpen, projectId, t]
  );

  const withCr = <T,>(fn: (id: string, d: CrDetail) => T): T | undefined => (detail ? fn(detail.change_request.cr_id, detail) : undefined);

  return {
    loading,
    detail,
    /** Nạp lại CR đang mở của mình (sau khi tạo CR từ danh sách rút); `prefer` = mở đúng CR đó nếu còn mở và của mình. */
    reloadOpen,
    pending,
    sent,
    busy,
    error,
    redraftFor,
    replies,
    /** Placeholder ô chat theo bước đang ở. */
    draftLocked,
    inputHint: !detail
      ? draftLocked
        ? t("hintLocked")
        : t("hintNew")
      : redraftFor
        ? t("hintRedraft")
        : detail.change_request.status === "awaiting_answers"
          ? t("hintAnswer")
          : t("hintAmend", { crId: detail.change_request.cr_id }),
    clearError: () => {
      setError(null);
      setOwnOpen(null);
    },
    ownOpen,
    /** `CR_OWN_OPEN`: mở lại CR đang dở của chính mình (thay vì tạo CR mới). */
    openOwn: async () => {
      const id = ownOpen?.crId;
      setBusy("create");
      try {
        const full = id ? (await getCr(projectId, id)).data : myUserId ? await fetchOwnOpenCr(projectId, myUserId) : null;
        if (!alive.current) return;
        if (!full) throw new Error("CR_OWN_OPEN_NOT_FOUND");
        setDetail(full);
        setPending(null);
        setPendingSeed(null);
        setPrefill(null);
        setSent(null);
        setError(null);
        setOwnOpen(null);
      } catch (err) {
        if (alive.current) setError(errorText(err));
      } finally {
        if (alive.current) setBusy(null);
      }
    },
    /**
     * Ẩn thẻ "CR-xxx đã ghi vào bản nháp" khi người dùng bắt đầu một lệnh sửa mới. Lệnh thêm / xoá use case đi vòng hỏi đáp +
     * bản xem trước riêng (FLF-318) không qua `send`, nên trang gọi hàm này ngay đầu mọi lệnh sửa.
     */
    clearSent: () => setSent(null),
    cancelPending: () => {
      setPending(null);
      setPendingSeed(null);
      setPrefill(null);
    },
    /** FLF-375: nguồn điền sẵn cho CR sắp tạo (lối vào từ gap report, comment, cờ…). */
    prefill,
    setPrefill,
    /**
     * FLF-318: bản xem trước thêm / xoá use case (vòng hỏi đáp như trước baseline) ⇒ "Tạo change request" mở thẻ chọn nguồn
     * + người yêu cầu ngay trong chat, CR tạo ra kèm bản xem trước đó.
     */
    startFromPreview: (instruction: string, description: string, previewId: string) => {
      setSent(null);
      setError(null);
      setPending(instruction.trim());
      setPendingSeed({ previewId, description });
    },
    /** Đang chờ chọn nguồn cho một bản xem trước (thẻ trong chat nói rõ CR mang đúng các thay đổi đã xem). */
    pendingFromPreview: pendingSeed !== null,
    isAccepted,
    /** Có bước AI chạy tiếp được (vd mở lại trang giữa chừng) ⇒ nút "Tiếp tục". */
    canContinue: detail ? nextAuto(detail) !== null : false,
    send,
    startCr,
    startFromFlags,
    continueFlow: () => void advance(detail),
    /** Phần AI chưa kết luận / trượt kiểm — để luồng chat nói rõ chỗ nào cần xử lý. */
    unconcluded: detail ? detail.locations.filter((l) => l.conclusion === null) : [],
    failing: detail ? detail.locations.filter(isFailing) : [],
    resume: () =>
      void withCr(async (id) => {
        const d = await call("resume", () => runCrAction(projectId, id, "resume"));
        await advance(d);
      }),
    answer: (answers: string[]) =>
      void withCr(async (id) => {
        if (answersWithdraw(answers)) return setWithdrawAsk(answers);
        const d = await call("answers", () => answerClarifications(projectId, id, answers));
        if (d?.change_request.withdraw_suggested) {
          setWithdrawSent(d);
          return setWithdrawAsk(answers);
        }
        await advance(d, accepted, null, true);
      }),
    /** FLF-439: câu trả lời đang chờ xác nhận là rút lại (`null` = không hỏi). */
    withdrawAsk,
    /** Câu hỏi "huỷ CR?" đến từ AI đọc câu trả lời đã gửi (CR có thể đã qua bước làm rõ). */
    withdrawAfterAnswer: withdrawSent !== null,
    /** Đúng là rút lại ⇒ huỷ CR, lý do ghi nguyên câu người dùng gõ. */
    confirmWithdraw: () =>
      void withCr(async (id) => {
        const text = (withdrawAsk ?? []).map((a) => a.trim()).filter(Boolean).join(" / ");
        const d = await call("cancel", () => cancelCr(projectId, id, t("withdrawReason", { text })));
        if (d) {
          setWithdrawAsk(null);
          setWithdrawSent(null);
        }
      }),
    /** Không phải rút lại ⇒ gửi đúng các câu đó làm câu trả lời như bình thường (đã gửi rồi thì chỉ đi tiếp). */
    answerAnyway: () =>
      void withCr(async (id) => {
        const answers = withdrawAsk;
        if (!answers) return;
        setWithdrawAsk(null);
        if (withdrawSent) {
          const sent = withdrawSent;
          setWithdrawSent(null);
          return advance(sent, accepted, null, true);
        }
        const d = await call("answers", () => answerClarifications(projectId, id, answers));
        await advance(d);
      }),
    dismissWithdraw: () => {
      setWithdrawAsk(null);
      setWithdrawSent(null);
    },
    addMaterialText: (name: string, text: string) => withCr((id) => call("material", () => addCrMaterialText(projectId, id, { name, text })).then((d) => d !== null)),
    addMaterialFile: (file: File) => withCr((id) => call("material", () => addCrMaterialFile(projectId, id, file))),
    removeMaterial: (materialId: string) => withCr((id) => call("material", () => deleteCrMaterial(projectId, id, materialId))),
    /** "Tiếp tục" sau danh sách phần liên quan ⇒ AI đề xuất (3.6). */
    proposeNow: () =>
      void withCr(async (id) => {
        const d = await call("propose", () => runCrAction(projectId, id, "propose"));
        await advance(d, accepted, "propose");
      }),
    /** Kiểm lại ngay (3.7) — nút "Kiểm lại" ở bước kiểm tra. */
    verifyNow: () =>
      void withCr(async (id) => {
        const d = await call("verify", () => runCrAction(projectId, id, "verify"));
        await advance(d, accepted, "verify");
      }),
    /** Soạn lại một vị trí theo hướng người dùng gõ ngay ở thẻ đề xuất (3.9). */
    redraft: (locId: string, instruction: string) =>
      withCr(async (id) => {
        const d = await call("redraft", () => draftInOwnerStep(projectId, id, locId, { instruction }));
        if (!d) return false;
        setRedraftFor(null);
        await advance(d);
        return true;
      }),
    accept: (loc: CrLocation) =>
      void withCr(async (id, d) => {
        const next = new Set(accepted);
        next.add(proposalKey(loc));
        saveAccepted(id, next);
        await advance(d, next);
      }),
    /**
     * FLF-375 "Đồng ý tất cả": đồng ý cùng lúc nhiều đề xuất — gom vào một lần lưu rồi chạy tiếp một lần (gọi `accept` lặp
     * lại sẽ đè nhau vì mỗi lần đọc cùng một tập đã đồng ý cũ).
     */
    acceptMany: (locs: readonly CrLocation[]) =>
      void withCr(async (id, d) => {
        if (!locs.length) return;
        const next = new Set(accepted);
        for (const l of locs) next.add(proposalKey(l));
        saveAccepted(id, next);
        await advance(d, next);
      }),
    /** Giữ nguyên / bỏ một chỗ (kèm lý do). `reason` riêng: vd "Bỏ yêu cầu" sau màn so sánh 3 cột (FLF-375). */
    reject: (loc: CrLocation, reason?: string) =>
      void withCr(async (id) => {
        const d = await call("reject", () =>
          patchLocation(projectId, id, loc.location_id, {
            conclusion: "not_related",
            // Vị trí sơ đồ gốc (§4.13): "bỏ" nghĩa là giữ hình người dùng vẽ sẵn
            reason: reason ?? (loc.found_by.includes("diagram") ? "Người yêu cầu giữ hình gốc của tài liệu" : "Người yêu cầu bỏ đề xuất này trong khung chat"),
          })
        );
        await advance(d);
      }),
    /** C-4 "Vẫn làm": ghi ý định giữ yêu cầu, AI soạn lại theo đúng yêu cầu (BE soạn ngay trong request, tốn credit). */
    proceed: (loc: CrLocation) =>
      void withCr(async (id) => {
        const d = await call("decide", () => patchLocation(projectId, id, loc.location_id, { action: "proceed" }));
        await advance(d);
      }),
    /**
     * C-5 "Giữ theo ý mình": chấp nhận cờ đỏ mới của chỗ này. Lựa chọn này cũng là sự đồng ý với đề xuất => ghi nhận luôn, rồi
     * kiểm lại - cờ đỏ còn lại chặn Gửi duyệt ở gói.
     */
    keep: (loc: CrLocation) =>
      void withCr(async (id) => {
        const d = await call("decide", () => patchLocation(projectId, id, loc.location_id, { action: "keep" }));
        if (!d) return;
        const next = new Set(accepted);
        const kept = d.locations.find((l) => l.location_id === loc.location_id);
        if (kept) next.add(proposalKey(kept));
        saveAccepted(id, next);
        await advance(d, next);
      }),
    /** "Hoàn tác" CR đã ghi: BE tạo CR mới (nguồn hoàn tác, đã kiểm) => mở luôn trong khung chat. */
    revert: async (fromCrId: string, requester: string) => {
      const d = await call("revert", () => revertCr(projectId, fromCrId, { requester: requester.trim() }));
      if (!d) return false;
      setSent(null);
      setRedraftFor(null);
      await advance(d, new Set());
      return true;
    },
    canRedraft: detail ? CR_REDRAFT_STATUSES.includes(detail.change_request.status) && !detail.change_request.paused : false,
    startRedraft: (locId: string) => setRedraftFor(locId),
    cancelRedraft: () => setRedraftFor(null),
    /** C-6 (FLF-330): BA xác nhận ⇒ ghi ngay vào bản nháp (`written`); lệnh sửa tiếp theo mở CR mới. */
    submit: () =>
      void withCr(async (id, before) => {
        const d = await call("submit", () => runCrAction(projectId, id, "submit"));
        if (d && (d.change_request.status === "written" || d.change_request.status === "in_review")) {
          writeStore(storageKey(projectId, id, "accepted"), null);
          writeStore(storageKey(projectId, id, "impact"), null);
          setSent(id);
          setDetail(null);
          setRedraftFor(null);
          // Cờ của nhóm chỉ đóng khi CR thật sự ghi vào bản nháp (`in_review` cũ chưa ghi gì)
          onWrittenRef.current?.(id, d.change_request.status === "written" ? (before.change_request.flag_ids ?? []) : []);
        } else if (d && d.change_request.status === "manual_fix") {
          // Kiểm lại lúc xác nhận thấy lỗi mới => chưa ghi gì; không báo thành công, chỉ ra chỗ phải xử lý
          setError(t("submitManual"));
        }
      }),
  };
}

export type CrChat = ReturnType<typeof useCrChat>;
